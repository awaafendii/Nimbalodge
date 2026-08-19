import { Module } from "@nestjs/common";

import { DepartmentsModule } from "../departments/departments.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { AnomalyDetectionModule } from "../anomaly-detection/anomaly-detection.module";
import { HospitalityInsightsModule } from "../hospitality-insights/hospitality-insights.module";
import { HrInsightsModule } from "../hr-insights/hr-insights.module";
import { AiOrchestratorService } from "./orchestrator/ai-orchestrator.service";
import { AiUsageService } from "./usage/ai-usage.service";

// Nimba AI (Étape 2 — AI Orchestrator). Toujours pas de contrôleur : la résolution permissions/
// scope (AiOrchestratorService.resolveContext) est testée unitairement pour l'instant, aucun Tool
// réel n'existe encore pour justifier un endpoint HTTP (arrive à l'Étape 4, quand Finance/
// Département auront de vraies données à exposer — voir le plan Nimba AI, "no dead endpoint" même
// principe que pour le module lui-même à l'Étape 1).
@Module({
  imports: [PermissionsModule, DepartmentsModule, HospitalityInsightsModule, HrInsightsModule, AnomalyDetectionModule],
  providers: [AiUsageService, AiOrchestratorService],
  exports: [AiUsageService, AiOrchestratorService],
})
export class NimbaAiModule {}
