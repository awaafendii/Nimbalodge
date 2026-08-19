import { randomUUID } from "node:crypto";

import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { STORAGE_PROVIDER, type StorageProvider } from "./storage/storage-provider.interface";

// Étape 7 (architecture d'upload) — liste blanche des types de ressource pouvant recevoir des
// documents. `prismaModel` sert au chargement générique de la ressource parente (pour la
// vérification de scope organisation/hôtel, même pattern que RESOURCE_MODEL_MAP dans
// AuditInterceptor) ; `viewPermission`/`managePermission` sont les permissions RBAC déjà existantes
// du domaine correspondant (aucune nouvelle permission créée pour cette phase).
interface ResourceTypeConfig {
  prismaModel: "expense" | "revenue" | "invoice" | "employee" | "supplier";
  viewPermission: string;
  managePermission: string;
}

const RESOURCE_TYPE_CONFIG: Record<string, ResourceTypeConfig> = {
  expenses: { prismaModel: "expense", viewPermission: "finance-expenses.view", managePermission: "finance-expenses.update" },
  revenues: { prismaModel: "revenue", viewPermission: "finance-revenues.view", managePermission: "finance-revenues.create" },
  invoices: { prismaModel: "invoice", viewPermission: "finance-invoices.view", managePermission: "finance-invoices.update" },
  employees: { prismaModel: "employee", viewPermission: "employees.view", managePermission: "employees.update" },
  suppliers: { prismaModel: "supplier", viewPermission: "suppliers.view", managePermission: "suppliers.update" },
};

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo — factures/reçus/justificatifs, pas de vidéo/archive.
const PATH_SEPARATORS = new Set(["/", "\\"]);

// Purement informatif (jamais utilisé comme chemin disque, voir storageKey) : retire séparateurs de
// chemin et caractères de contrôle, tronque à 200 caractères. Filtre caractère par caractère plutôt
// qu'une regex de plage de contrôle, pour rester lisible sans jonglage d'échappement.
function sanitizeFilename(original: string): string {
  let cleaned = "";
  for (const ch of original) {
    const code = ch.codePointAt(0) ?? 0;
    if (PATH_SEPARATORS.has(ch)) {
      cleaned += "_";
    } else if (code > 31 && code !== 127) {
      cleaned += ch;
    }
  }
  return cleaned.slice(0, 200) || "document";
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider
  ) {}

  private resourceConfig(resourceType: string): ResourceTypeConfig {
    const config = RESOURCE_TYPE_CONFIG[resourceType];
    if (!config) {
      throw new BadRequestException(`Type de ressource non pris en charge pour un document : ${resourceType}`);
    }
    return config;
  }

  // Charge la ressource parente et vérifie le scope organisation/hôtel — même garantie que
  // n'importe quelle action directe sur cette ressource (assertInScope), avant même de considérer
  // les permissions RBAC : un document ne doit jamais fuiter hors scope, quelle que soit la
  // permission de l'appelant.
  private async loadParentInScope(resourceType: string, resourceId: string, requester: AuthenticatedUser) {
    const config = this.resourceConfig(resourceType);
    const prismaModels = this.prisma as unknown as Record<
      string,
      { findUnique: (args: unknown) => Promise<unknown> }
    >;
    const model = prismaModels[config.prismaModel]!;
    const parent = (await model.findUnique({ where: { id: resourceId }, include: { hotel: true } })) as {
      hotelId: string;
      hotel: { organizationId: string };
    } | null;
    if (!parent) {
      throw new NotFoundException("Ressource introuvable");
    }
    assertInScope(parent.hotel.organizationId, parent.hotelId, requester);
    return parent;
  }

  private async requirePermission(userId: string, permission: string): Promise<void> {
    const { permissions } = await this.permissions.resolveForUser(userId);
    if (!permissions.has(permission)) {
      throw new ForbiddenException("Permissions insuffisantes");
    }
  }

  async upload(
    resourceType: string,
    resourceId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    requester: AuthenticatedUser,
    ipAddress: string | null
  ) {
    const config = this.resourceConfig(resourceType);
    const parent = await this.loadParentInScope(resourceType, resourceId, requester);
    await this.requirePermission(requester.id, config.managePermission);

    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        `Type de fichier non autorisé : ${file.mimetype}. Formats acceptés : PDF, JPEG, PNG, WEBP.`
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(`Fichier trop volumineux (max ${MAX_SIZE_BYTES / (1024 * 1024)} Mo)`);
    }
    if (file.size === 0) {
      throw new BadRequestException("Fichier vide");
    }

    // storageKey toujours aléatoire — jamais dérivé du nom de fichier original (empêche toute
    // collision ou traversée de répertoire, voir LocalDiskStorageProvider).
    const storageKey = `${resourceType}/${resourceId}/${randomUUID()}${extension}`;
    await this.storage.save(storageKey, file.buffer);

    const document = await this.prisma.document.create({
      data: {
        filename: sanitizeFilename(file.originalname),
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        resourceType,
        resourceId,
        hotelId: parent.hotelId,
        organizationId: parent.hotel.organizationId,
        uploadedById: requester.id,
      },
    });

    this.audit.record({
      userId: requester.id,
      organizationId: parent.hotel.organizationId,
      hotelId: parent.hotelId,
      method: "POST",
      path: `/documents/${resourceType}/${resourceId}`,
      resourceType: "documents",
      resourceId: document.id,
      action: "upload",
      outcome: "SUCCESS",
      ipAddress,
      after: { filename: document.filename, mimeType: document.mimeType, sizeBytes: document.sizeBytes },
    });

    return {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      createdAt: document.createdAt,
    };
  }

  async list(resourceType: string, resourceId: string, requester: AuthenticatedUser) {
    const config = this.resourceConfig(resourceType);
    await this.loadParentInScope(resourceType, resourceId, requester);
    await this.requirePermission(requester.id, config.viewPermission);

    return this.prisma.document.findMany({
      where: { resourceType, resourceId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true, uploadedById: true },
    });
  }

  async download(documentId: string, requester: AuthenticatedUser) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) {
      throw new NotFoundException("Document introuvable");
    }
    const config = this.resourceConfig(document.resourceType);
    await this.loadParentInScope(document.resourceType, document.resourceId, requester);
    await this.requirePermission(requester.id, config.viewPermission);

    const buffer = await this.storage.read(document.storageKey);
    return { buffer, filename: document.filename, mimeType: document.mimeType };
  }

  async remove(documentId: string, requester: AuthenticatedUser, ipAddress: string | null): Promise<{ success: true }> {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) {
      throw new NotFoundException("Document introuvable");
    }
    const config = this.resourceConfig(document.resourceType);
    await this.loadParentInScope(document.resourceType, document.resourceId, requester);
    await this.requirePermission(requester.id, config.managePermission);

    // Suppression réelle du contenu physique, pas seulement une marque en base — voir schema.prisma.
    await this.storage.delete(document.storageKey);
    await this.prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });

    this.audit.record({
      userId: requester.id,
      organizationId: document.organizationId,
      hotelId: document.hotelId,
      method: "DELETE",
      path: `/documents/${documentId}`,
      resourceType: "documents",
      resourceId: documentId,
      action: "delete",
      outcome: "SUCCESS",
      ipAddress,
      before: { filename: document.filename },
    });

    return { success: true };
  }
}
