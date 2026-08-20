import { Injectable } from "@nestjs/common";

import { ReportsService } from "../../reports/reports.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { Anomaly } from "../anomaly";
import type { AnomalyDetector } from "./anomaly-detector.interface";
import { fmtDecimal, severityForRatio } from "./severity";

// Écart relatif période-sur-période, par catégorie financière (groupBy="category", réutilise
// ReportsService.financialReport() sans rien recalculer). Couvre à la fois "dépenses anormalement
// élevées", "recettes inhabituelles" et "variations importantes par rapport aux périodes
// précédentes" — trois items du brief traités par un seul détecteur cohérent plutôt que trois
// détecteurs partiellement redondants. Seuil : 20% d'écart relatif (règle simple, pas de moyenne
// glissante multi-période dans cette v1 — voir plan Nimba AI, "règles/seuils uniquement").
const SIGNIFICANT_RATIO = 0.2;

@Injectable()
export class RevenueExpenseTrendDetector implements AnomalyDetector {
  readonly source = "revenue-expense-trend";
  readonly requiredPermission = "reports.financial.view";

  constructor(private readonly reportsService: ReportsService) {}

  async detect(requester: AuthenticatedUser, dateFrom: Date, dateTo: Date): Promise<Anomaly[]> {
    const periodLengthMs = dateTo.getTime() - dateFrom.getTime();
    const previousDateFrom = new Date(dateFrom.getTime() - periodLengthMs);
    const previousDateTo = dateFrom;

    const [current, previous] = await Promise.all([
      this.reportsService.financialReport({ dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString(), groupBy: "category" }, requester),
      this.reportsService.financialReport({ dateFrom: previousDateFrom.toISOString(), dateTo: previousDateTo.toISOString(), groupBy: "category" }, requester),
    ]);

    const previousByKey = new Map(previous.rows.map((row) => [row.key, row]));
    const period = { from: dateFrom.toISOString(), to: dateTo.toISOString() };
    const anomalies: Anomaly[] = [];

    for (const row of current.rows) {
      const prevRow = previousByKey.get(row.key);
      // Pas de référence sur la période précédente -> donnée insuffisante pour juger d'un écart,
      // jamais traité comme une anomalie par défaut.
      if (!prevRow) continue;

      if (prevRow.totalExpense.greaterThan(0)) {
        const ratio = row.totalExpense.minus(prevRow.totalExpense).dividedBy(prevRow.totalExpense).toNumber();
        if (ratio >= SIGNIFICANT_RATIO) {
          anomalies.push({
            severity: severityForRatio(ratio),
            indicator: `Dépenses — ${row.label}`,
            period,
            observedValue: fmtDecimal(row.totalExpense),
            referenceValue: fmtDecimal(prevRow.totalExpense),
            explanation: `Les dépenses de la catégorie "${row.label}" (${fmtDecimal(row.totalExpense)}) ont augmenté de ${Math.round(ratio * 100)}% par rapport à la période précédente (${fmtDecimal(prevRow.totalExpense)}).`,
            recommendation: "Vérifier les dépenses récentes de cette catégorie.",
            resourceType: "financial-category",
            resourceId: row.key,
          });
        }
      }

      if (prevRow.totalRevenue.greaterThan(0)) {
        const dropRatio = prevRow.totalRevenue.minus(row.totalRevenue).dividedBy(prevRow.totalRevenue).toNumber();
        if (dropRatio >= SIGNIFICANT_RATIO) {
          anomalies.push({
            severity: severityForRatio(dropRatio),
            indicator: `Recettes — ${row.label}`,
            period,
            observedValue: fmtDecimal(row.totalRevenue),
            referenceValue: fmtDecimal(prevRow.totalRevenue),
            explanation: `Les recettes de la catégorie "${row.label}" (${fmtDecimal(row.totalRevenue)}) ont baissé de ${Math.round(dropRatio * 100)}% par rapport à la période précédente (${fmtDecimal(prevRow.totalRevenue)}).`,
            recommendation: "Vérifier si cette baisse est saisonnière ou révèle un problème (annulations, arrêt d'activité...).",
            resourceType: "financial-category",
            resourceId: row.key,
          });
        }
      }
    }

    return anomalies;
  }
}
