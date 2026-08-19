import { randomUUID } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
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
    this.audit.record({
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
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

    return this.issueTokens(user.id, user.organizationId, user.hotelId, meta);
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

    return this.issueTokens(user.id, user.organizationId, user.hotelId, meta);
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

  async resolveMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, hotel: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const { roleNames, permissions } = await this.permissions.resolveForUser(userId);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organization: { id: user.organization.id, name: user.organization.name },
      hotel: user.hotel ? { id: user.hotel.id, name: user.hotel.name } : null,
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
