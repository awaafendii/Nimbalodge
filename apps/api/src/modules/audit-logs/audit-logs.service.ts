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

  async findOne(id: string, requester: AuthenticatedUser) {
    const auditLog = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!auditLog) {
      throw new NotFoundException("Entrée d'audit introuvable");
    }
    assertInScope(auditLog.organizationId ?? "", auditLog.hotelId, requester);
    return toAuditLogDetailResponse(auditLog);
  }
}
