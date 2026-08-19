import { Module } from "@nestjs/common";

import { DepartmentsModule } from "../departments/departments.module";
import { FinanceSummaryModule } from "../finance-summary/finance-summary.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { ReportsModule } from "../reports/reports.module";
import { AnomalyDetectionModule } from "../anomaly-detection/anomaly-detection.module";
import { HospitalityInsightsModule } from "../hospitality-insights/hospitality-insights.module";
import { HrInsightsModule } from "../hr-insights/hr-insights.module";
import { DepartmentInsightsMinimizer } from "./context/department-insights.minimizer";
import { FinanceInsightsMinimizer } from "./context/finance-insights.minimizer";
import { AiOrchestratorService } from "./orchestrator/ai-orchestrator.service";
import { AI_TOOLS, type AiTool } from "./tools/ai-tool.interface";
import { AiToolRegistry } from "./tools/ai-tool-registry";
import { DepartmentInsightsTool } from "./tools/department-insights.tool";
import { FinanceInsightsTool } from "./tools/finance-insights.tool";
import { AiUsageService } from "./usage/ai-usage.service";

// Nimba AI (Étape 4 — data access layer sécurisé). Toujours pas de contrôleur HTTP : les deux
// premiers Tools existent et sont enregistrés dans AiToolRegistry via le multi-provider AI_TOOLS,
// mais aucun endpoint public ne les expose encore — arrive à l'Étape 7 (UI Insights), une fois
// Hospitality/HR ajoutés eux aussi, pour livrer un écran complet plutôt qu'un endpoint isolé.
// D'ici là, invokeTool() est exercé directement par les tests (registre + orchestrateur).
@Module({
  imports: [
    PermissionsModule,
    DepartmentsModule,
    FinanceSummaryModule,
    ReportsModule,
    HospitalityInsightsModule,
    HrInsightsModule,
    AnomalyDetectionModule,
  ],
  providers: [
    AiUsageService,
    FinanceInsightsMinimizer,
    DepartmentInsightsMinimizer,
    FinanceInsightsTool,
    DepartmentInsightsTool,
    {
      provide: AI_TOOLS,
      useFactory: (financeTool: FinanceInsightsTool, departmentTool: DepartmentInsightsTool): AiTool[] => [
        financeTool,
        departmentTool,
      ],
      inject: [FinanceInsightsTool, DepartmentInsightsTool],
    },
    AiToolRegistry,
    AiOrchestratorService,
  ],
  exports: [AiUsageService, AiToolRegistry, AiOrchestratorService],
})
export class NimbaAiModule {}
