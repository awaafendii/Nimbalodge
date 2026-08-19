import { NotFoundException } from "@nestjs/common";

import type { AuditService } from "../../common/audit/audit.service";
import type { PrismaService } from "../../database/prisma.service";
import { SessionsService } from "./sessions.service";

describe("SessionsService", () => {
  function buildService() {
    const prisma = {
      refreshToken: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    const audit = { record: jest.fn() };
    const service = new SessionsService(prisma as unknown as PrismaService, audit as unknown as AuditService);
    return { service, prisma, audit };
  }

  describe("list", () => {
    it("ne retourne que les sessions non révoquées et non expirées, sans jamais exposer tokenHash", async () => {
      const { service, prisma } = buildService();
      prisma.refreshToken.findMany.mockResolvedValue([
        { id: "s1", userAgent: "Chrome/1.0", ipAddress: "1.1.1.1", createdAt: new Date(), expiresAt: new Date() },
      ]);

      const result = await service.list("user-1");

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", revokedAt: null, expiresAt: { gt: expect.any(Date) } },
          select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("revoke", () => {
    it("rejette (404) une session inconnue", async () => {
      const { service, prisma } = buildService();
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.revoke("user-1", "unknown-session", null)).rejects.toThrow(NotFoundException);
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it("rejette (404, pas 403) une session appartenant à un autre utilisateur", async () => {
      const { service, prisma } = buildService();
      prisma.refreshToken.findUnique.mockResolvedValue({ id: "s1", userId: "other-user" });

      await expect(service.revoke("user-1", "s1", null)).rejects.toThrow(NotFoundException);
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it("révoque une session appartenant bien à l'appelant", async () => {
      const { service, prisma, audit } = buildService();
      prisma.refreshToken.findUnique.mockResolvedValue({ id: "s1", userId: "user-1" });

      const result = await service.revoke("user-1", "s1", "127.0.0.1");

      expect(result).toEqual({ success: true });
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { revokedAt: expect.any(Date), revokedReason: "user-revoked" },
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "session-revoke", outcome: "SUCCESS" }));
    });
  });

  describe("revokeAll", () => {
    it("révoque toutes les sessions actives de l'utilisateur et retourne le nombre révoqué", async () => {
      const { service, prisma, audit } = buildService();
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.revokeAll("user-1", "127.0.0.1");

      expect(result).toEqual({ success: true, revokedCount: 3 });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date), revokedReason: "user-revoked-all" },
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "session-revoke-all", outcome: "SUCCESS" }));
    });
  });
});
