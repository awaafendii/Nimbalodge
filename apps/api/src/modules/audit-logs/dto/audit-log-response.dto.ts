import type { AuditLog } from "@prisma/client";

export function toAuditLogResponse(auditLog: AuditLog) {
  return {
    id: auditLog.id,
    organizationId: auditLog.organizationId,
    hotelId: auditLog.hotelId,
    userId: auditLog.userId,
    method: auditLog.method,
    path: auditLog.path,
    resourceType: auditLog.resourceType,
    outcome: auditLog.outcome,
    errorMessage: auditLog.errorMessage,
    ipAddress: auditLog.ipAddress,
    createdAt: auditLog.createdAt,
  };
}
