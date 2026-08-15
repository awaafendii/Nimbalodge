import { Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { toAuditLogResponse } from "./dto/audit-log-response.dto";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // organizationId/hotelId sont des champs libres (pas de relation) sur AuditLog — le filtrage de
  // scope se fait directement sur ces scalaires, pas via le pattern `hotel: {organizationId}`
  // utilisé partout ailleurs (qui suppose une vraie relation).
  async list(query: ListAuditLogsQueryDto, requester: AuthenticatedUser) {
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        organizationId: requester.organizationId,
        ...(requester.hotelId ? { hotelId: requester.hotelId } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lt: new Date(query.dateTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      // Contrairement aux autres list() du projet (sans pagination, volume "métier" limité),
      // AuditLog grandit au rythme des requêtes HTTP mutantes, pas des actions humaines — une
      // limite est nécessaire dès cette phase. `dateFrom`/`dateTo`/`userId`/`resourceType`
      // permettent de cibler au-delà des 200 plus récents.
      take: 200,
    });
    return auditLogs.map(toAuditLogResponse);
  }
}
