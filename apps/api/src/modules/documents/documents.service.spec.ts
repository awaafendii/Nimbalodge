import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";

import type { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import type { PrismaService } from "../../database/prisma.service";
import type { PermissionsService } from "../permissions/permissions.service";
import { DocumentsService } from "./documents.service";
import type { StorageProvider } from "./storage/storage-provider.interface";

describe("DocumentsService", () => {
  const requester: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const parentExpense = { hotelId: "hotel-1", hotel: { organizationId: "org-1" } };

  function buildService(grantedPermissions: string[] = ["finance-expenses.view", "finance-expenses.update"]) {
    const prisma = {
      expense: { findUnique: jest.fn().mockResolvedValue(parentExpense) },
      document: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    const permissions = { resolveForUser: jest.fn().mockResolvedValue({ permissions: new Set(grantedPermissions) }) };
    const audit = { record: jest.fn() };
    const storage = { save: jest.fn(), read: jest.fn(), delete: jest.fn() };
    const service = new DocumentsService(
      prisma as unknown as PrismaService,
      permissions as unknown as PermissionsService,
      audit as unknown as AuditService,
      storage as unknown as StorageProvider
    );
    return { service, prisma, permissions, audit, storage };
  }

  const validFile = { originalname: "facture.pdf", mimetype: "application/pdf", size: 1024, buffer: Buffer.from("x") };

  describe("upload", () => {
    it("rejette un resourceType inconnu", async () => {
      const { service } = buildService();
      await expect(service.upload("unknown-type", "res-1", validFile, requester, null)).rejects.toThrow(BadRequestException);
    });

    it("rejette si la ressource parente est hors scope (autre organisation)", async () => {
      const { service, prisma } = buildService();
      prisma.expense.findUnique.mockResolvedValue({ hotelId: "hotel-1", hotel: { organizationId: "other-org" } });
      await expect(service.upload("expenses", "res-1", validFile, requester, null)).rejects.toThrow();
    });

    it("rejette si l'appelant n'a pas la permission de gestion", async () => {
      const { service } = buildService(["finance-expenses.view"]); // pas .update
      await expect(service.upload("expenses", "res-1", validFile, requester, null)).rejects.toThrow(ForbiddenException);
    });

    it("rejette un type MIME non autorisé", async () => {
      const { service } = buildService();
      const file = { ...validFile, mimetype: "application/x-msdownload" };
      await expect(service.upload("expenses", "res-1", file, requester, null)).rejects.toThrow(BadRequestException);
    });

    it("rejette un fichier trop volumineux", async () => {
      const { service } = buildService();
      const file = { ...validFile, size: 11 * 1024 * 1024 };
      await expect(service.upload("expenses", "res-1", file, requester, null)).rejects.toThrow(BadRequestException);
    });

    it("rejette un fichier vide", async () => {
      const { service } = buildService();
      const file = { ...validFile, size: 0 };
      await expect(service.upload("expenses", "res-1", file, requester, null)).rejects.toThrow(BadRequestException);
    });

    it("stocke le fichier sous une clé aléatoire (jamais dérivée du nom original) et journalise", async () => {
      const { service, prisma, storage, audit } = buildService();
      prisma.document.create.mockResolvedValue({
        id: "doc-1",
        filename: "facture.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        createdAt: new Date(),
      });

      const result = await service.upload("expenses", "res-1", validFile, requester, "127.0.0.1");

      expect(storage.save).toHaveBeenCalledTimes(1);
      const [storageKey, buffer] = storage.save.mock.calls[0];
      expect(storageKey).toMatch(/^expenses\/res-1\/[a-f0-9-]+\.pdf$/);
      expect(buffer).toBe(validFile.buffer);
      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resourceType: "expenses", resourceId: "res-1", hotelId: "hotel-1", organizationId: "org-1" }),
        })
      );
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "upload", outcome: "SUCCESS" }));
      expect(result.id).toBe("doc-1");
    });

    it("assainit le nom de fichier affiché (jamais utilisé comme chemin) sans affecter la clé de stockage", async () => {
      const { service, prisma, storage } = buildService();
      prisma.document.create.mockResolvedValue({
        id: "doc-1",
        filename: "___etc_passwd",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        createdAt: new Date(),
      });
      const maliciousFile = { ...validFile, originalname: "../../etc/passwd" };

      await service.upload("expenses", "res-1", maliciousFile, requester, null);

      // `filename` est purement informatif (jamais un chemin) : la seule garantie nécessaire est
      // l'absence de séparateur de chemin, pas l'absence de "..", inoffensif sans séparateur.
      const createCall = prisma.document.create.mock.calls[0][0];
      expect(createCall.data.filename).not.toContain("/");
      expect(createCall.data.filename).not.toContain("\\");
      // storageKey (le seul chemin disque réel) est un UUID généré côté serveur, jamais dérivé du
      // nom original -- il ne contient donc jamais de fragment du nom de fichier fourni par le client.
      expect(storage.save.mock.calls[0][0]).not.toContain("etc");
    });
  });

  describe("list", () => {
    it("rejette sans la permission de vue", async () => {
      const { service } = buildService([]);
      await expect(service.list("expenses", "res-1", requester)).rejects.toThrow(ForbiddenException);
    });

    it("ne retourne que les documents non supprimés", async () => {
      const { service, prisma } = buildService();
      prisma.document.findMany.mockResolvedValue([{ id: "doc-1" }]);

      const result = await service.list("expenses", "res-1", requester);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { resourceType: "expenses", resourceId: "res-1", deletedAt: null } })
      );
      expect(result).toEqual([{ id: "doc-1" }]);
    });
  });

  describe("download", () => {
    it("rejette un document inconnu ou déjà supprimé", async () => {
      const { service, prisma } = buildService();
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.download("doc-1", requester)).rejects.toThrow(NotFoundException);

      prisma.document.findUnique.mockResolvedValue({ deletedAt: new Date() });
      await expect(service.download("doc-1", requester)).rejects.toThrow(NotFoundException);
    });

    it("lit le contenu via le storage provider après vérification de scope et permission", async () => {
      const { service, prisma, storage } = buildService();
      prisma.document.findUnique.mockResolvedValue({
        id: "doc-1",
        deletedAt: null,
        resourceType: "expenses",
        resourceId: "res-1",
        storageKey: "expenses/res-1/abc.pdf",
        filename: "facture.pdf",
        mimeType: "application/pdf",
      });
      storage.read.mockResolvedValue(Buffer.from("content"));

      const result = await service.download("doc-1", requester);

      expect(storage.read).toHaveBeenCalledWith("expenses/res-1/abc.pdf");
      expect(result.filename).toBe("facture.pdf");
    });
  });

  describe("remove", () => {
    it("supprime réellement le contenu physique, marque deletedAt, et journalise", async () => {
      const { service, prisma, storage, audit } = buildService();
      prisma.document.findUnique.mockResolvedValue({
        id: "doc-1",
        deletedAt: null,
        resourceType: "expenses",
        resourceId: "res-1",
        storageKey: "expenses/res-1/abc.pdf",
        filename: "facture.pdf",
        hotelId: "hotel-1",
        organizationId: "org-1",
      });

      const result = await service.remove("doc-1", requester, "127.0.0.1");

      expect(result).toEqual({ success: true });
      expect(storage.delete).toHaveBeenCalledWith("expenses/res-1/abc.pdf");
      expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: "doc-1" }, data: { deletedAt: expect.any(Date) } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "delete", outcome: "SUCCESS" }));
    });

    it("rejette sans la permission de gestion", async () => {
      const { service, prisma } = buildService(["finance-expenses.view"]);
      prisma.document.findUnique.mockResolvedValue({
        id: "doc-1",
        deletedAt: null,
        resourceType: "expenses",
        resourceId: "res-1",
        storageKey: "expenses/res-1/abc.pdf",
        hotelId: "hotel-1",
        organizationId: "org-1",
      });

      await expect(service.remove("doc-1", requester, null)).rejects.toThrow(ForbiddenException);
    });
  });
});
