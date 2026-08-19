-- Étape 7 (durcissement Audit Trail) — étend AuditLog : departmentId, resourceId, action sémantique
-- ("create"/"approve"/"login"/...), snapshots before/after (JSON, assainis des secrets par
-- AuditService avant écriture). Lignes existantes : action="unknown" (donnée déjà historique, pas
-- rejouable a posteriori) via le DEFAULT, avant/after/resourceId/departmentId restent NULL.

ALTER TABLE "AuditLog"
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "resourceId" TEXT,
  ADD COLUMN "action" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB;

CREATE INDEX "AuditLog_departmentId_idx" ON "AuditLog"("departmentId");
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
