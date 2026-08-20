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
import { HospitalityInsightsMinimizer } from "./context/hospitality-insights.minimizer";
import { HrPayrollMinimizer } from "./context/hr-payroll.minimizer";
import { HrWorkforceMinimizer } from "./context/hr-workforce.minimizer";
import { CONVERSATION_PROVIDER_TOKEN } from "./conversation/conversation-provider.interface";
import { StatelessConversationProvider } from "./conversation/stateless-conversation.provider";
import { NimbaAiController } from "./nimba-ai.controller";
import { AiOrchestratorService } from "./orchestrator/ai-orchestrator.service";
import { LlmProviderModule } from "./providers/llm-provider.module";
import { AI_TOOLS, type AiTool } from "./tools/ai-tool.interface";
import { AiToolRegistry } from "./tools/ai-tool-registry";
import { DepartmentInsightsTool } from "./tools/department-insights.tool";
import { FinanceInsightsTool } from "./tools/finance-insights.tool";
import { HospitalityInsightsTool } from "./tools/hospitality-insights.tool";
import { HrPayrollTool } from "./tools/hr-payroll.tool";
import { HrWorkforceTool } from "./tools/hr-workforce.tool";
import { AiUsageService } from "./usage/ai-usage.service";

// Nimba AI (Étape 7 — Système d'Insights). Premier contrôleur HTTP : 5 Tools couvrent désormais
// Finance/Département/Hôtellerie/RH-effectif/RH-paie, chacun gardé par sa permission réelle. RH
// scindé en deux Tools (hr-workforce-summary vs hr-payroll-summary) plutôt qu'un seul, pour que
// payslips.view (donnée salariale) gate la masse salariale indépendamment de employees.view
// (visibilité RH courante) — reproduit exactement l'exemple du brief.
@Module({
  imports: [
    PermissionsModule,
    DepartmentsModule,
    FinanceSummaryModule,
    ReportsModule,
    HospitalityInsightsModule,
    HrInsightsModule,
    AnomalyDetectionModule,
    LlmProviderModule,
  ],
  controllers: [NimbaAiController],
  providers: [
    AiUsageService,
    FinanceInsightsMinimizer,
    DepartmentInsightsMinimizer,
    HospitalityInsightsMinimizer,
    HrWorkforceMinimizer,
    HrPayrollMinimizer,
    FinanceInsightsTool,
    DepartmentInsightsTool,
    HospitalityInsightsTool,
    HrWorkforceTool,
    HrPayrollTool,
    {
      provide: AI_TOOLS,
      useFactory: (
        financeTool: FinanceInsightsTool,
        departmentTool: DepartmentInsightsTool,
        hospitalityTool: HospitalityInsightsTool,
        hrWorkforceTool: HrWorkforceTool,
        hrPayrollTool: HrPayrollTool
      ): AiTool[] => [financeTool, departmentTool, hospitalityTool, hrWorkforceTool, hrPayrollTool],
      inject: [FinanceInsightsTool, DepartmentInsightsTool, HospitalityInsightsTool, HrWorkforceTool, HrPayrollTool],
    },
    AiToolRegistry,
    StatelessConversationProvider,
    { provide: CONVERSATION_PROVIDER_TOKEN, useExisting: StatelessConversationProvider },
    AiOrchestratorService,
  ],
  exports: [AiUsageService, AiToolRegistry, AiOrchestratorService],
})
export class NimbaAiModule {}
