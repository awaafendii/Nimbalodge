import { randomBytes } from "node:crypto";

import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";

import { AuditService } from "../../common/audit/audit.service";
import { hashToken } from "../../common/crypto/hash-token";
import { PrismaService } from "../../database/prisma.service";
import { AuthService, type TwoFactorChallengePayload } from "./auth.service";

const RECOVERY_CODE_COUNT = 8;
const TOTP_ISSUER = "NimbaLodge";
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;

function buildTotp(base32Secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

function generateRecoveryCode(): string {
  return randomBytes(5).toString("hex").toUpperCase(); // 10 caractères hex, distinct visuellement d'un code TOTP à 6 chiffres.
}

// Étape 7 (durcissement Auth) — 2FA TOTP (RFC 6238), colonnes User.twoFactorEnabled/twoFactorSecret
// préparées depuis la Phase 3, jamais exploitées avant cette phase. setup() persiste un secret
// immédiatement mais twoFactorEnabled reste false tant que enable() n'a pas vérifié un code réel
// (empêche un attaquant ayant compromis une session de basculer 2FA à distance sans jamais
// démontrer qu'il contrôle un authenticator).
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly authService: AuthService
  ) {}

  private get challengeSecret(): string {
    return this.config.get<string>("JWT_2FA_CHALLENGE_SECRET")!;
  }

  async setup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = new OTPAuth.Secret({ size: 20 });
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret.base32 } });
    const totp = buildTotp(secret.base32, user.email);
    return { secret: secret.base32, otpauthUrl: totp.toString() };
  }

  async enable(userId: string, code: string, ipAddress: string | null): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) {
      throw new BadRequestException("Aucune configuration 2FA en attente — appelez /auth/2fa/setup d'abord");
    }
    const totp = buildTotp(user.twoFactorSecret, user.email);
    if (totp.validate({ token: code, window: 1 }) === null) {
      this.audit.record({
        userId: user.id,
        organizationId: user.organizationId,
        hotelId: user.hotelId,
        method: "POST",
        path: "/auth/2fa/enable",
        resourceType: "auth",
        resourceId: user.id,
        action: "2fa-enable",
        outcome: "FAILURE",
        errorMessage: "Code TOTP invalide",
        ipAddress,
      });
      throw new BadRequestException("Code invalide");
    }

    const rawCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorRecoveryCode.createMany({
        data: rawCodes.map((code) => ({ userId, codeHash: hashToken(code) })),
      }),
    ]);

    this.audit.record({
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      method: "POST",
      path: "/auth/2fa/enable",
      resourceType: "auth",
      resourceId: user.id,
      action: "2fa-enable",
      outcome: "SUCCESS",
      ipAddress,
    });

    return { recoveryCodes: rawCodes };
  }

  async disable(userId: string, password: string, ipAddress: string | null): Promise<{ success: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      this.audit.record({
        userId: user.id,
        organizationId: user.organizationId,
        hotelId: user.hotelId,
        method: "POST",
        path: "/auth/2fa/disable",
        resourceType: "auth",
        resourceId: user.id,
        action: "2fa-disable",
        outcome: "FAILURE",
        errorMessage: "Mot de passe invalide",
        ipAddress,
      });
      throw new ForbiddenException("Mot de passe invalide");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    ]);

    this.audit.record({
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      method: "POST",
      path: "/auth/2fa/disable",
      resourceType: "auth",
      resourceId: user.id,
      action: "2fa-disable",
      outcome: "SUCCESS",
      ipAddress,
    });

    return { success: true };
  }

  async verifyChallenge(challengeToken: string, code: string, ipAddress: string | null) {
    let payload: TwoFactorChallengePayload;
    try {
      payload = await this.jwt.verifyAsync<TwoFactorChallengePayload>(challengeToken, { secret: this.challengeSecret });
    } catch {
      throw new UnauthorizedException("Challenge 2FA invalide ou expiré");
    }
    if (payload.purpose !== "2fa-challenge") {
      throw new UnauthorizedException("Challenge 2FA invalide ou expiré");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException("Challenge 2FA invalide ou expiré");
    }

    const totp = buildTotp(user.twoFactorSecret, user.email);
    const totpValid = totp.validate({ token: code, window: 1 }) !== null;
    const recoveryUsed = totpValid ? null : await this.tryConsumeRecoveryCode(user.id, code);

    if (!totpValid && !recoveryUsed) {
      this.audit.record({
        userId: user.id,
        organizationId: user.organizationId,
        hotelId: user.hotelId,
        method: "POST",
        path: "/auth/2fa/verify",
        resourceType: "auth",
        resourceId: user.id,
        action: "2fa-verify",
        outcome: "FAILURE",
        errorMessage: "Code invalide",
        ipAddress,
      });
      throw new UnauthorizedException("Code invalide");
    }

    this.audit.record({
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      method: "POST",
      path: "/auth/2fa/verify",
      resourceType: "auth",
      resourceId: user.id,
      action: "2fa-verify",
      outcome: "SUCCESS",
      errorMessage: recoveryUsed ? "Code de récupération utilisé" : undefined,
      ipAddress,
    });

    return this.authService.issueTokens(user.id, user.organizationId, user.hotelId);
  }

  private async tryConsumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const codeHash = hashToken(code.toUpperCase());
    const stored = await this.prisma.twoFactorRecoveryCode.findFirst({ where: { userId, codeHash, usedAt: null } });
    if (!stored) return false;
    await this.prisma.twoFactorRecoveryCode.update({ where: { id: stored.id }, data: { usedAt: new Date() } });
    return true;
  }
}
