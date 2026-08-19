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
import { CONVERSATION_PROVIDER_TOKEN } from "./conversation/conversation-provider.interface";
import { StatelessConversationProvider } from "./conversation/stateless-conversation.provider";
import { AiOrchestratorService } from "./orchestrator/ai-orchestrator.service";
import { LlmProviderModule } from "./providers/llm-provider.module";
import { AI_TOOLS, type AiTool } from "./tools/ai-tool.interface";
import { AiToolRegistry } from "./tools/ai-tool-registry";
import { DepartmentInsightsTool } from "./tools/department-insights.tool";
import { FinanceInsightsTool } from "./tools/finance-insights.tool";
import { AiUsageService } from "./usage/ai-usage.service";

// Nimba AI (Étape 5 — LLM Provider abstraction). Toujours pas de contrôleur HTTP : LLMProvider/
// ConversationProvider existent et sont testés en isolation, mais rien ne les appelle encore dans
// le flux de l'orchestrateur — ce câblage arrive à l'Étape 9 (Assistant conversationnel), en même
// temps que le premier vrai usage conversationnel. D'ici là, invokeTool() (Insights, sans LLM)
// reste le seul chemin exercé de bout en bout.
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
    StatelessConversationProvider,
    { provide: CONVERSATION_PROVIDER_TOKEN, useExisting: StatelessConversationProvider },
    AiOrchestratorService,
  ],
  exports: [AiUsageService, AiToolRegistry, AiOrchestratorService],
})
export class NimbaAiModule {}
