import { Module } from "@nestjs/common";

import { DepartmentsModule } from "../departments/departments.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { AnomalyDetectionModule } from "../anomaly-detection/anomaly-detection.module";
import { HospitalityInsightsModule } from "../hospitality-insights/hospitality-insights.module";
import { HrInsightsModule } from "../hr-insights/hr-insights.module";
import { AiOrchestratorService } from "./orchestrator/ai-orchestrator.service";
import { AiToolRegistry } from "./tools/ai-tool-registry";
import { AiUsageService } from "./usage/ai-usage.service";

// Nimba AI (Étape 3 — RBAC / scope enforcement). Toujours pas de contrôleur : AiToolRegistry
// n'a encore aucun Tool enregistré (le multi-provider AI_TOOLS reste vide jusqu'à l'Étape 4,
// quand Finance/Département auront de vraies données à exposer — voir le plan Nimba AI,
// "no dead endpoint").
@Module({
  imports: [PermissionsModule, DepartmentsModule, HospitalityInsightsModule, HrInsightsModule, AnomalyDetectionModule],
  providers: [AiUsageService, AiToolRegistry, AiOrchestratorService],
  exports: [AiUsageService, AiToolRegistry, AiOrchestratorService],
})
export class NimbaAiModule {}
