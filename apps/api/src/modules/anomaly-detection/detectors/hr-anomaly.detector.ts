import { Injectable } from "@nestjs/common";

import { HrInsightsService } from "../../hr-insights/hr-insights.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { Anomaly } from "../anomaly";
import type { AnomalyDetector } from "./anomaly-detector.interface";
import { severityForRatio } from "./severity";

// Pic d'absentéisme période-sur-période. Réutilise HrInsightsService.getWorkforceSummary() tel
// quel (agrégats uniquement — aucune donnée nominative ne transite jamais par ce détecteur).
const SIGNIFICANT_RATIO = 0.2;

@Injectable()
export class HrAnomalyDetector implements AnomalyDetector {
  readonly source = "hr-anomaly";
  readonly requiredPermission = "employees.view";

  constructor(private readonly hrInsightsService: HrInsightsService) {}

  async detect(requester: AuthenticatedUser, dateFrom: Date, dateTo: Date): Promise<Anomaly[]> {
    const periodLengthMs = dateTo.getTime() - dateFrom.getTime();
    const previousDateFrom = new Date(dateFrom.getTime() - periodLengthMs);

    const [current, previous] = await Promise.all([
      this.hrInsightsService.getWorkforceSummary({ dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() }, requester),
      this.hrInsightsService.getWorkforceSummary({ dateFrom: previousDateFrom.toISOString(), dateTo: dateFrom.toISOString() }, requester),
    ]);

    // Aucun poste planifié sur l'une des deux périodes -> pas de taux mesurable, jamais de 0%
    // artificiel ni d'anomalie inventée faute de référence.
    if (current.absenteeismRate === null || previous.absenteeismRate === null || previous.absenteeismRate <= 0) {
      return [];
    }

    const ratio = (current.absenteeismRate - previous.absenteeismRate) / previous.absenteeismRate;
    if (ratio < SIGNIFICANT_RATIO) return [];

    const currentPct = Math.round(current.absenteeismRate * 100);
    const previousPct = Math.round(previous.absenteeismRate * 100);

    return [
      {
        severity: severityForRatio(ratio),
        indicator: "Absentéisme",
        period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
        observedValue: `${currentPct}%`,
        referenceValue: `${previousPct}%`,
        explanation: `Le taux d'absentéisme (${currentPct}%) a augmenté de ${Math.round(ratio * 100)}% par rapport à la période précédente (${previousPct}%).`,
        recommendation: "Vérifier les causes possibles (sous-effectif planifié, congés non déclarés...).",
        resourceType: "workforce",
      },
    ];
  }
}
