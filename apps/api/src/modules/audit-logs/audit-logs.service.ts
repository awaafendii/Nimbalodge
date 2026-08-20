import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { assertInScope } from "../../common/utils/assert-in-scope";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { toAuditLogDetailResponse, toAuditLogResponse } from "./dto/audit-log-response.dto";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // organizationId/hotelId sont des champs libres (pas de relation) sur AuditLog — le filtrage de
  // scope se fait directement sur ces scalaires, pas via le pattern `hotel: {organizationId}`
  // utilisé partout ailleurs (qui suppose une vraie relation).
  private buildWhere(query: ListAuditLogsQueryDto, requester: AuthenticatedUser): Prisma.AuditLogWhereInput {
    // Un demandeur déjà lié à un seul hôtel (JWT hotelId non nul) ne peut jamais en sortir, même en
    // passant ?hotelId=<autre>. Un demandeur org-wide (hotelId JWT null) peut volontairement
    // restreindre à un hôtel de son organisation via le filtre.
    const effectiveHotelId = requester.hotelId ?? query.hotelId;

    return {
      organizationId: requester.organizationId,
      ...(effectiveHotelId ? { hotelId: effectiveHotelId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lt: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { path: { contains: query.search, mode: "insensitive" } },
              { resourceType: { contains: query.search, mode: "insensitive" } },
              { action: { contains: query.search, mode: "insensitive" } },
              { method: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  async list(query: ListAuditLogsQueryDto, requester: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildWhere(query, requester);

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map(toAuditLogResponse),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // Nimba AI (Étape 8, AuditTrailAnomalyDetector) — rafale d'échecs (connexions refusées, accès
  // refusés) par utilisateur ou par IP sur une fenêtre donnée. Deux groupBy distincts : un échec de
  // connexion anonyme a un userId nul mais une ipAddress réelle, un refus de permission a l'inverse
  // un userId réel — jamais fusionnés, sinon une rafale par IP resterait invisible.
  async countFailuresByActor(dateFrom: Date, dateTo: Date, requester: AuthenticatedUser) {
    const effectiveHotelId = requester.hotelId ?? undefined;
    const baseWhere: Prisma.AuditLogWhereInput = {
      organizationId: requester.organizationId,
      ...(effectiveHotelId ? { hotelId: effectiveHotelId } : {}),
      outcome: "FAILURE",
      createdAt: { gte: dateFrom, lt: dateTo },
    };

    const [byUser, byIp] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ["userId"],
        where: { ...baseWhere, userId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ["ipAddress"],
        where: { ...baseWhere, ipAddress: { not: null } },
        _count: { _all: true },
      }),
    ]);

    return {
      byUser: byUser.map((row) => ({ userId: row.userId as string, count: row._count._all })),
      byIp: byIp.map((row) => ({ ipAddress: row.ipAddress as string, count: row._count._all })),
    };
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const auditLog = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!auditLog) {
      throw new NotFoundException("Entrée d'audit introuvable");
    }
    assertInScope(auditLog.organizationId ?? "", auditLog.hotelId, requester);
    return toAuditLogDetailResponse(auditLog);
  }
}
