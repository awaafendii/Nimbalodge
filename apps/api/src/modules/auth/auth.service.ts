import { randomUUID } from "node:crypto";

import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

import { AuditService } from "../../common/audit/audit.service";
import { hashToken } from "../../common/crypto/hash-token";
import { PrismaService } from "../../database/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";

interface AccessTokenPayload {
  sub: string;
  organizationId: string;
  hotelId: string | null;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

// Étape 7 — payload du token de challenge 2FA, signé avec JWT_2FA_CHALLENGE_SECRET (jamais
// JWT_ACCESS_SECRET : voir env.validation.ts). `purpose` est une garde explicite en plus du secret
// distinct — défense en profondeur, vérifiée par TwoFactorService avant tout usage.
export interface TwoFactorChallengePayload {
  sub: string;
  purpose: "2fa-challenge";
}

export type LoginResult = { accessToken: string; refreshToken: string } | { twoFactorRequired: true; challengeToken: string };

// Étape 7 — métadonnées de session (RefreshToken.userAgent/ipAddress), purement informatives pour
// "mes sessions actives" (voir sessions.service.ts) — jamais utilisées pour une décision de
// sécurité. userAgent tronqué à 255 caractères avant écriture.
export interface SessionMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

// Payload d'accès minimal (pas de permissions embarquées, voir docs/architecture/phase-3-auth-rbac.md
// — pas de Redis, un payload figé deviendrait périmé dès qu'un rôle change). Le refresh token est
// lui-même un JWT signé avec un secret distinct, mais rendu révocable via une ligne RefreshToken
// en base (id = jti, tokenHash en SHA-256, jamais le token brut).
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService
  ) {}

  private get accessSecret(): string {
    return this.config.get<string>("JWT_ACCESS_SECRET")!;
  }
  private get refreshSecret(): string {
    return this.config.get<string>("JWT_REFRESH_SECRET")!;
  }
  private get accessExpiresIn(): string {
    return this.config.get<string>("JWT_ACCESS_EXPIRES_IN")!;
  }
  private get refreshExpiresIn(): string {
    return this.config.get<string>("JWT_REFRESH_EXPIRES_IN")!;
  }
  private get twoFactorChallengeSecret(): string {
    return this.config.get<string>("JWT_2FA_CHALLENGE_SECRET")!;
  }

  async login(email: string, password: string, meta: SessionMeta = { userAgent: null, ipAddress: null }): Promise<LoginResult> {
    const ipAddress = meta.ipAddress;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      this.audit.record({
        userId: user?.id ?? null,
        organizationId: user?.organizationId ?? null,
        hotelId: user?.hotelId ?? null,
        method: "POST",
        path: "/auth/login",
        resourceType: "auth",
        resourceId: user?.id ?? null,
        action: "login",
        outcome: "FAILURE",
        errorMessage: `Identifiants invalides (email: ${email})`,
        ipAddress,
      });
      throw new UnauthorizedException("Identifiants invalides");
    }
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      this.audit.record({
        userId: user.id,
        organizationId: user.organizationId,
        hotelId: user.hotelId,
        method: "POST",
        path: "/auth/login",
        resourceType: "auth",
        resourceId: user.id,
        action: "login",
        outcome: "FAILURE",
        errorMessage: `Identifiants invalides (email: ${email})`,
        ipAddress,
      });
      throw new UnauthorizedException("Identifiants invalides");
    }
    const activeHotelId = await this.resolveActiveHotelId(user.id, user.hotelId);
    this.audit.record({
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: activeHotelId,
      method: "POST",
      path: "/auth/login",
      resourceType: "auth",
      resourceId: user.id,
      action: "login",
      outcome: "SUCCESS",
      ipAddress,
    });

    if (user.twoFactorEnabled) {
      // Mot de passe correct mais pas encore une session complète : le client doit maintenant
      // prouver la possession du second facteur via POST /auth/2fa/verify (voir
      // two-factor.service.ts) avant qu'un vrai access/refresh token ne soit émis.
      const challengeToken = await this.jwt.signAsync(
        { sub: user.id, purpose: "2fa-challenge" } satisfies TwoFactorChallengePayload,
        { secret: this.twoFactorChallengeSecret, expiresIn: "5m" }
      );
      return { twoFactorRequired: true, challengeToken };
    }

    return this.issueTokens(user.id, user.organizationId, activeHotelId, meta);
  }

  // RBAC multi-hôtel (audit) : `User.hotelId` n'est plus l'autorité pour un utilisateur qui a au
  // moins une HotelMembership — l'hôtel actif de la session provient alors exclusivement d'une
  // membership ACTIVE. Mais un utilisateur SANS AUCUNE membership (SUPER_ADMIN, qui n'en a
  // typiquement aucune ; ou un utilisateur pas encore migré vers le modèle membership) garde le
  // comportement historique : `preferredHotelId` (= `User.hotelId`) tel quel, jamais `null` par
  // défaut — repli explicite, pas un contournement, pour ne pas élargir silencieusement l'accès
  // (`null` = org-wide) d'un utilisateur qui était hôtel-scopé avant cette migration.
  // Ordre de préférence si des memberships existent : celle correspondant à `preferredHotelId`
  // (continuité pour un utilisateur mono-hôtel habituel) sinon la première (ordre de création).
  private async resolveActiveHotelId(userId: string, preferredHotelId: string | null): Promise<string | null> {
    const memberships = await this.prisma.hotelMembership.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    const first = memberships[0];
    if (!first) return preferredHotelId;
    const preferred = preferredHotelId ? memberships.find((m) => m.hotelId === preferredHotelId) : undefined;
    return (preferred ?? first).hotelId;
  }

  // POST /auth/switch-hotel — jamais un hotelId accepté tel quel : toujours revalidé contre une
  // HotelMembership(status: ACTIVE) réelle avant réémission des tokens (le frontend ne peut jamais
  // décider seul de l'hôtel actif). SUPER_ADMIN n'a normalement aucune membership et n'utilise pas
  // ce endpoint (déjà org-wide via hotelId: null) — un SUPER_ADMIN sans membership sur l'hôtel visé
  // reçoit donc le même 403 que n'importe quel autre utilisateur, par design (§6 : pas de
  // contournement silencieux, même pour la plateforme).
  async switchHotel(userId: string, targetHotelId: string, meta: SessionMeta = { userAgent: null, ipAddress: null }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Utilisateur introuvable ou inactif");
    }

    const membership = await this.prisma.hotelMembership.findUnique({
      where: { userId_hotelId: { userId, hotelId: targetHotelId } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      this.audit.record({
        userId,
        organizationId: user.organizationId,
        hotelId: targetHotelId,
        method: "POST",
        path: "/auth/switch-hotel",
        resourceType: "auth",
        resourceId: userId,
        action: "switch-hotel",
        outcome: "FAILURE",
        errorMessage: "Aucune affectation active sur cet établissement",
        ipAddress: meta.ipAddress,
      });
      throw new ForbiddenException("Vous n'avez pas accès à cet établissement");
    }

    this.audit.record({
      userId,
      organizationId: user.organizationId,
      hotelId: targetHotelId,
      method: "POST",
      path: "/auth/switch-hotel",
      resourceType: "auth",
      resourceId: userId,
      action: "switch-hotel",
      outcome: "SUCCESS",
      ipAddress: meta.ipAddress,
    });

    // Persisté comme indice "dernier hôtel actif" pour que login()/refreshTokens() y reviennent
    // naturellement ensuite (resolveActiveHotelId) — jamais relu comme autorité en soi, toujours
    // revalidé contre une HotelMembership active à chaque émission de token.
    await this.prisma.user.update({ where: { id: userId }, data: { hotelId: targetHotelId } });

    return this.issueTokens(userId, user.organizationId, targetHotelId, meta);
  }

  async refreshTokens(rawToken: string, meta: SessionMeta = { userAgent: null, ipAddress: null }) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException("Refresh token invalide");
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.expiresAt < new Date() || stored.tokenHash !== hashToken(rawToken)) {
      throw new UnauthorizedException("Refresh token invalide ou révoqué");
    }

    if (stored.revokedAt) {
      // Réutilisation d'un refresh token déjà révoqué — pas systématiquement un vol : seule une
      // révocation par ROTATION ("rotated") est un vrai signal de compromission (dans une chaîne
      // de rotation normale, seul le tout dernier token émis est valide ; en voir un ancien
      // resurgir signale une copie interceptée, rejouée en parallèle du légitime). Une révocation
      // volontaire ("logout"/"user-revoked"/"password-reset") n'en est pas un : le device qui
      // présente encore ce token ne sait simplement pas encore qu'il a été déconnecté (course
      // bénigne, pas une attaque) — déclencher la cascade dans ce cas déconnecterait à tort toutes
      // les AUTRES sessions actives de l'utilisateur, découvert en testant en direct le
      // "sign out this device" (voir schema.prisma, RefreshToken.revokedReason).
      if (stored.revokedReason === "rotated") {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: "reuse-detected" },
        });
      }
      throw new UnauthorizedException("Refresh token invalide ou révoqué");
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Utilisateur introuvable ou inactif");
    }

    // Rotation : l'ancien refresh token est révoqué dès qu'il sert, même en cas de réutilisation.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), revokedReason: "rotated" },
    });

    const activeHotelId = await this.resolveActiveHotelId(user.id, user.hotelId);
    return this.issueTokens(user.id, user.organizationId, activeHotelId, meta);
  }

  async logout(rawToken: string, ipAddress: string | null = null): Promise<{ success: true }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: this.refreshSecret,
        ignoreExpiration: true,
      });
    } catch {
      // Token déjà invalide/mal formé : pas d'acteur identifiable, rien à journaliser — on répond
      // succès pour rester idempotent.
      return { success: true };
    }
    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "logout" },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { organizationId: true, hotelId: true },
    });
    this.audit.record({
      userId: payload.sub,
      organizationId: user?.organizationId ?? null,
      hotelId: user?.hotelId ?? null,
      method: "POST",
      path: "/auth/logout",
      resourceType: "auth",
      resourceId: payload.sub,
      action: "logout",
      outcome: "SUCCESS",
      ipAddress,
    });
    return { success: true };
  }

  // `activeHotelId` vient du JWT de la session courante (voir AuthController.me), jamais de
  // `User.hotelId` directement : après un switch-hotel, cette réponse doit refléter l'hôtel
  // réellement actif de CETTE session, pas le dernier hôtel par défaut de l'utilisateur (qui
  // suit, sans jamais être l'autorité — voir resolveActiveHotelId).
  async resolveMe(userId: string, activeHotelId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const [{ roleNames, permissions }, activeHotel, memberships] = await Promise.all([
      this.permissions.resolveForUser(userId, activeHotelId),
      activeHotelId ? this.prisma.hotel.findUnique({ where: { id: activeHotelId } }) : Promise.resolve(null),
      this.prisma.hotelMembership.findMany({
        where: { userId, status: "ACTIVE" },
        include: { hotel: true, role: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organization: { id: user.organization.id, name: user.organization.name },
      hotel: activeHotel ? { id: activeHotel.id, name: activeHotel.name } : null,
      // Établissements réellement accessibles (HotelMembership active) — alimente le
      // HotelSwitcher frontend. Absent/vide pour un utilisateur org-wide sans membership
      // (ex. SUPER_ADMIN), qui garde `hotel: null` (déjà géré côté Sidebar : "tous hôtels").
      hotels: memberships.map((m) => ({ id: m.hotel.id, name: m.hotel.name, role: m.role.name })),
      roles: roleNames,
      permissions: Array.from(permissions).sort(),
    };
  }

  // Public : appelé aussi par TwoFactorService après vérification réussie du 2e facteur (voir
  // two-factor.service.ts, verifyChallenge()) — un vrai access/refresh token n'est émis qu'après
  // cette étape quand 2FA est activé, jamais directement depuis login().
  async issueTokens(
    userId: string,
    organizationId: string,
    hotelId: string | null,
    meta: SessionMeta = { userAgent: null, ipAddress: null }
  ) {
    const accessPayload: AccessTokenPayload = { sub: userId, organizationId, hotelId };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: userId, jti };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });

    const decoded = this.jwt.decode(refreshToken) as { exp?: number } | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        ipAddress: meta.ipAddress,
      },
    });

    return { accessToken, refreshToken };
  }
}
