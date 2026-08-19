import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import * as OTPAuth from "otpauth";

import type { AuditService } from "../../common/audit/audit.service";
import type { PrismaService } from "../../database/prisma.service";
import type { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";

// Unit — Prisma/Audit/AuthService/JwtService mockés. Couvre la logique métier isolée : un secret
// en attente (setup) ne devient actif qu'après vérification d'un vrai code (enable), les codes de
// récupération sont à usage unique, disable() exige le mot de passe courant.
describe("TwoFactorService", () => {
  function buildService() {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      twoFactorRecoveryCode: { deleteMany: jest.fn(), createMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    const jwt = { verifyAsync: jest.fn() };
    const config = { get: jest.fn(() => "test-2fa-challenge-secret") };
    const audit = { record: jest.fn() };
    const authService = { issueTokens: jest.fn().mockResolvedValue({ accessToken: "at", refreshToken: "rt" }) };
    const service = new TwoFactorService(
      prisma as unknown as PrismaService,
      jwt as unknown as import("@nestjs/jwt").JwtService,
      config as unknown as import("@nestjs/config").ConfigService,
      audit as unknown as AuditService,
      authService as unknown as AuthService
    );
    return { service, prisma, jwt, audit, authService };
  }

  const baseUser = {
    id: "user-1",
    email: "hoteladmin@nimbalodge.dev",
    organizationId: "org-1",
    hotelId: "hotel-1",
    isActive: true,
    passwordHash: "$2a$12$irrelevant",
    twoFactorEnabled: false,
    twoFactorSecret: null as string | null,
  };

  describe("setup", () => {
    it("génère et persiste un secret, mais n'active pas encore le 2FA", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUniqueOrThrow.mockResolvedValue(baseUser);

      const result = await service.setup(baseUser.id);

      expect(result.secret).toMatch(/^[A-Z2-7]+$/); // base32
      expect(result.otpauthUrl).toContain("otpauth://totp/");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { twoFactorSecret: result.secret },
      });
    });
  });

  describe("enable", () => {
    it("rejette si aucun setup n'a été fait (pas de secret en attente)", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...baseUser, twoFactorSecret: null });

      await expect(service.enable(baseUser.id, "123456", null)).rejects.toThrow(BadRequestException);
    });

    it("rejette un code TOTP invalide", async () => {
      const { service, prisma } = buildService();
      const secret = new OTPAuth.Secret({ size: 20 });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...baseUser, twoFactorSecret: secret.base32 });

      await expect(service.enable(baseUser.id, "000000", null)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("active le 2FA et retourne 8 codes de récupération pour un code TOTP valide", async () => {
      const { service, prisma } = buildService();
      const secret = new OTPAuth.Secret({ size: 20 });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...baseUser, twoFactorSecret: secret.base32 });
      const totp = new OTPAuth.TOTP({ issuer: "NimbaLodge", label: baseUser.email, digits: 6, period: 30, secret });
      const validCode = totp.generate();

      const result = await service.enable(baseUser.id, validCode, null);

      expect(result.recoveryCodes).toHaveLength(8);
      expect(new Set(result.recoveryCodes).size).toBe(8); // tous distincts
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("disable", () => {
    it("rejette un mot de passe invalide", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUniqueOrThrow.mockResolvedValue(baseUser);

      await expect(service.disable(baseUser.id, "wrong-password", null)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("verifyChallenge", () => {
    it("rejette un challenge token qui échoue la vérification JWT", async () => {
      const { service, jwt } = buildService();
      jwt.verifyAsync.mockRejectedValue(new Error("invalid signature"));

      await expect(service.verifyChallenge("garbage", "123456", null)).rejects.toThrow(UnauthorizedException);
    });

    it("rejette un token dont le purpose n'est pas 2fa-challenge", async () => {
      const { service, jwt } = buildService();
      jwt.verifyAsync.mockResolvedValue({ sub: baseUser.id, purpose: "something-else" });

      await expect(service.verifyChallenge("token", "123456", null)).rejects.toThrow(UnauthorizedException);
    });

    it("émet de vrais tokens pour un code TOTP valide", async () => {
      const { service, prisma, jwt, authService } = buildService();
      const secret = new OTPAuth.Secret({ size: 20 });
      const user = { ...baseUser, twoFactorEnabled: true, twoFactorSecret: secret.base32 };
      jwt.verifyAsync.mockResolvedValue({ sub: user.id, purpose: "2fa-challenge" });
      prisma.user.findUnique.mockResolvedValue(user);
      const totp = new OTPAuth.TOTP({ issuer: "NimbaLodge", label: user.email, digits: 6, period: 30, secret });

      const result = await service.verifyChallenge("token", totp.generate(), null);

      expect(result).toEqual({ accessToken: "at", refreshToken: "rt" });
      expect(authService.issueTokens).toHaveBeenCalledWith(user.id, user.organizationId, user.hotelId);
    });

    it("accepte un code de récupération valide et le marque comme utilisé (usage unique)", async () => {
      const { service, prisma, jwt, authService } = buildService();
      const secret = new OTPAuth.Secret({ size: 20 });
      const user = { ...baseUser, twoFactorEnabled: true, twoFactorSecret: secret.base32 };
      jwt.verifyAsync.mockResolvedValue({ sub: user.id, purpose: "2fa-challenge" });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.twoFactorRecoveryCode.findFirst.mockResolvedValue({ id: "code-1", userId: user.id, usedAt: null });

      const result = await service.verifyChallenge("token", "ABCDEF1234", null);

      expect(result).toEqual({ accessToken: "at", refreshToken: "rt" });
      expect(prisma.twoFactorRecoveryCode.update).toHaveBeenCalledWith({
        where: { id: "code-1" },
        data: { usedAt: expect.any(Date) },
      });
      expect(authService.issueTokens).toHaveBeenCalled();
    });

    it("rejette un code qui n'est ni un TOTP valide ni un code de récupération connu", async () => {
      const { service, prisma, jwt } = buildService();
      const secret = new OTPAuth.Secret({ size: 20 });
      const user = { ...baseUser, twoFactorEnabled: true, twoFactorSecret: secret.base32 };
      jwt.verifyAsync.mockResolvedValue({ sub: user.id, purpose: "2fa-challenge" });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.twoFactorRecoveryCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyChallenge("token", "000000", null)).rejects.toThrow(UnauthorizedException);
    });
  });
});
