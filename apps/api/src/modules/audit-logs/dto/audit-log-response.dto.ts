import type { AuditLog } from "@prisma/client";

export function toAuditLogResponse(auditLog: AuditLog) {
  return {
    id: auditLog.id,
    organizationId: auditLog.organizationId,
    hotelId: auditLog.hotelId,
    departmentId: auditLog.departmentId,
    userId: auditLog.userId,
    method: auditLog.method,
    path: auditLog.path,
    resourceType: auditLog.resourceType,
    resourceId: auditLog.resourceId,
    action: auditLog.action,
    outcome: auditLog.outcome,
    errorMessage: auditLog.errorMessage,
    ipAddress: auditLog.ipAddress,
    createdAt: auditLog.createdAt,
  };
}

// Détail (GET /audit-logs/:id) uniquement : before/after peuvent contenir l'intégralité d'une
// ressource métier (jusqu'à avant redaction, voir AuditService.sanitizeAuditValue) — jamais inclus
// dans la liste paginée pour ne pas alourdir un écran qui peut afficher des dizaines de lignes.
export function toAuditLogDetailResponse(auditLog: AuditLog) {
  return {
    ...toAuditLogResponse(auditLog),
    before: auditLog.before,
    after: auditLog.after,
  };
}
