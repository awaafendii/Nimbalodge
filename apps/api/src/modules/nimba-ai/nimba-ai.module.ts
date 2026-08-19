import { Module } from "@nestjs/common";

import { AnomalyDetectionModule } from "../anomaly-detection/anomaly-detection.module";
import { HospitalityInsightsModule } from "../hospitality-insights/hospitality-insights.module";
import { HrInsightsModule } from "../hr-insights/hr-insights.module";
import { AiUsageService } from "./usage/ai-usage.service";

// Nimba AI (Étape 1 — squelette d'architecture). Le contrôleur et l'AiOrchestratorService
// arrivent à l'Étape 2 du plan Nimba AI, une fois qu'il y a un point d'entrée HTTP réel à
// exposer — un contrôleur sans route utilisable n'a pas sa place dans ce dépôt (voir la
// suppression du composant ComingSoon, Étape 7 Priority 9 : pas de scaffold mort). Importe déjà
// les modules d'insights/anomalies autonomes pour que l'orchestrateur puisse les injecter dès
// l'Étape 2 sans reconfiguration de module.
@Module({
  imports: [HospitalityInsightsModule, HrInsightsModule, AnomalyDetectionModule],
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class NimbaAiModule {}
