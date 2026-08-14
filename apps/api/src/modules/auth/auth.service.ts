import { createHash, randomUUID } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

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

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
    private readonly permissions: PermissionsService
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

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Identifiants invalides");
    }
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Identifiants invalides");
    }
    return this.issueTokens(user.id, user.organizationId, user.hotelId);
  }

  async refreshTokens(rawToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException("Refresh token invalide");
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.tokenHash !== hashToken(rawToken)) {
      throw new UnauthorizedException("Refresh token invalide ou révoqué");
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Utilisateur introuvable ou inactif");
    }

    // Rotation : l'ancien refresh token est révoqué dès qu'il sert, même en cas de réutilisation.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    return this.issueTokens(user.id, user.organizationId, user.hotelId);
  }

  async logout(rawToken: string): Promise<{ success: true }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: this.refreshSecret,
        ignoreExpiration: true,
      });
    } catch {
      // Token déjà invalide/mal formé : rien à révoquer, on répond succès pour rester idempotent.
      return { success: true };
    }
    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
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

  private async issueTokens(userId: string, organizationId: string, hotelId: string | null) {
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
      },
    });

    return { accessToken, refreshToken };
  }
}
