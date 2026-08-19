import { Module } from "@nestjs/common";

import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  // Exporté pour Nimba AI (DepartmentInsightsTool, Étape 4) — réutilise financialReport()
  // directement plutôt que de dupliquer sa logique de regroupement/scope.
  exports: [ReportsService],
})
export class ReportsModule {}
