import { Injectable } from "@nestjs/common";

import { HospitalityInsightsService } from "../../hospitality-insights/hospitality-insights.service";
import { HospitalityInsightsMinimizer } from "../context/hospitality-insights.minimizer";
import { buildProvenance } from "../context/provenance";
import type { AiResponseEnvelope } from "../dto/ai-response-envelope";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import type { AiTool } from "./ai-tool.interface";
import type { HospitalityInsightsMinimized } from "../context/hospitality-insights.minimizer";

export interface HospitalityInsightsInput {
  dateFrom?: string;
  dateTo?: string;
}

// Nimba AI (Étape 7). Enveloppe HospitalityInsightsService.getOccupancySummary() — occupation,
// ADR, RevPAR, réservations par statut, comparaison à la période précédente. Permission alignée
// sur l'équivalent REST le plus proche (liste des réservations) puisqu'aucun endpoint REST
// équivalent n'existe encore pour ces KPIs agrégés.
@Injectable()
export class HospitalityInsightsTool
  implements AiTool<HospitalityInsightsInput, AiResponseEnvelope<HospitalityInsightsMinimized>>
{
  readonly name = "occupancy-summary";
  readonly description =
    "Taux d'occupation, ADR, RevPAR, et répartition des réservations par statut pour une période donnée, avec comparaison à la période précédente.";
  readonly requiredPermissions = ["reservations.view"];

  constructor(
    private readonly hospitalityInsightsService: HospitalityInsightsService,
    private readonly minimizer: HospitalityInsightsMinimizer
  ) {}

  async execute(
    input: HospitalityInsightsInput,
    context: AiRequestContext
  ): Promise<AiResponseEnvelope<HospitalityInsightsMinimized>> {
    const raw = await this.hospitalityInsightsService.getOccupancySummary(input, context.user);
    const data = this.minimizer.minimize(raw);

    return {
      data,
      provenance: [buildProvenance("Hôtellerie → Occupation", { period: data.period })],
    };
  }
}
