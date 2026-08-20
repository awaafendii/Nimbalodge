import { Module } from "@nestjs/common";

import { AuditLogsController } from "./audit-logs.controller";
import { AuditLogsService } from "./audit-logs.service";

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  // Exporté pour Nimba AI (AuditTrailAnomalyDetector, Étape 8) — réutilise
  // countFailuresByActor() directement plutôt que de dupliquer le scope organisation/hôtel.
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
