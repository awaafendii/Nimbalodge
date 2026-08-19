import { BadRequestException } from "@nestjs/common";

import type { AuditService } from "../../common/audit/audit.service";
import type { PrismaService } from "../../database/prisma.service";
import { PasswordResetService } from "./password-reset.service";

// Unit — Prisma/Audit entièrement mockés (pas de base réelle), au contraire des e2e-spec du
// dossier apps/api/test/. Se concentre sur la logique métier isolée : jamais de fuite d'existence
// de compte, expiration/usage unique appliqués, révocation des sessions après changement de mot
// de passe.
describe("PasswordResetService", () => {
  function buildService() {
    const prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      passwordResetToken: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
    };
    const audit = { record: jest.fn() };
    const service = new PasswordResetService(prisma as unknown as PrismaService, audit as unknown as AuditService);
    return { service, prisma, audit };
  }

  const activeUser = {
    id: "user-1",
    email: "hoteladmin@nimbalodge.dev",
    isActive: true,
    organizationId: "org-1",
    hotelId: "hotel-1",
  };

  describe("requestReset", () => {
    it("répond succès générique et ne crée aucun token quand l'email n'existe pas (anti-énumération)", async () => {
      const { service, prisma, audit } = buildService();
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestReset("inconnu@example.com", "127.0.0.1");

      expect(result).toEqual({ success: true });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "FAILURE", action: "password-reset-request" }));
    });

    it("répond succès générique sans créer de token pour un compte désactivé", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });

      const result = await service.requestReset(activeUser.email, "127.0.0.1");

      expect(result).toEqual({ success: true });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it("crée un token avec expiration ~30 min pour un compte actif", async () => {
      const { service, prisma, audit } = buildService();
      prisma.user.findUnique.mockResolvedValue(activeUser);
      const before = Date.now();

      await service.requestReset(activeUser.email, "127.0.0.1");

      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const call = prisma.passwordResetToken.create.mock.calls[0][0];
      expect(call.data.userId).toBe(activeUser.id);
      expect(typeof call.data.tokenHash).toBe("string");
      expect(call.data.tokenHash).toHaveLength(64); // SHA-256 hex
      const expiresAtMs = (call.data.expiresAt as Date).getTime();
      expect(expiresAtMs - before).toBeGreaterThan(29 * 60 * 1000);
      expect(expiresAtMs - before).toBeLessThan(31 * 60 * 1000);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "SUCCESS", action: "password-reset-request", userId: activeUser.id }));
    });
  });

  describe("confirmReset", () => {
    it("rejette un token inconnu, expiré ou déjà utilisé (findFirst ne retourne rien)", async () => {
      const { service, prisma, audit } = buildService();
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.confirmReset("garbage-token", "NewPassword123!", "127.0.0.1")).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "FAILURE", action: "password-reset-confirm" }));
    });

    it("met à jour le mot de passe, marque le token utilisé, et révoque toutes les sessions actives", async () => {
      const { service, prisma, audit } = buildService();
      const storedToken = { id: "reset-1", userId: activeUser.id, tokenHash: "x", usedAt: null };
      prisma.passwordResetToken.findFirst.mockResolvedValue(storedToken);
      prisma.user.update.mockResolvedValue(activeUser);

      const result = await service.confirmReset("raw-token-value", "NewPassword123!", "127.0.0.1");

      expect(result).toEqual({ success: true });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: activeUser.id },
        data: { passwordHash: expect.any(String) },
      });
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: storedToken.id },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: activeUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "SUCCESS", action: "password-reset-confirm" }));
    });

    it("stocke un hash bcrypt, jamais le mot de passe en clair", async () => {
      const { service, prisma } = buildService();
      prisma.passwordResetToken.findFirst.mockResolvedValue({ id: "reset-1", userId: activeUser.id, tokenHash: "x", usedAt: null });
      prisma.user.update.mockResolvedValue(activeUser);

      await service.confirmReset("raw-token-value", "NewPassword123!", "127.0.0.1");

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.passwordHash).not.toBe("NewPassword123!");
      expect(updateCall.data.passwordHash.startsWith("$2")).toBe(true); // préfixe bcrypt
    });
  });
});
