import { Injectable } from "@nestjs/common";

import { BudgetsService } from "../../budgets/budgets.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { Anomaly } from "../anomaly";
import type { AnomalyDetector } from "./anomaly-detector.interface";
import { fmtDecimal, severityForRatio } from "./severity";

// Règle : réalisé > prévu sur une ligne de budget EXPENSE active. Réutilise
// BudgetsService.getExecution() telle quelle (même logique que checkOverspendAlerts) — ne
// recalcule rien, ne déclenche jamais de notification (lecture pure).
@Injectable()
export class BudgetOverspendDetector implements AnomalyDetector {
  readonly source = "budget-overspend";
  readonly requiredPermission = "finance-budgets.view";

  constructor(private readonly budgetsService: BudgetsService) {}

  async detect(requester: AuthenticatedUser, dateFrom: Date, dateTo: Date): Promise<Anomaly[]> {
    const budgets = await this.budgetsService.list(requester);
    const activeBudgets = budgets.filter(
      (budget) => budget.isActive && budget.startDate < dateTo && budget.endDate > dateFrom
    );

    const anomalies: Anomaly[] = [];
    for (const budget of activeBudgets) {
      const execution = await this.budgetsService.getExecution(budget.id, requester);
      for (const line of execution.lines) {
        if (line.type !== "EXPENSE" || !line.actual.greaterThan(line.planned)) continue;
        const ratio = line.planned.greaterThan(0) ? line.actual.minus(line.planned).dividedBy(line.planned).toNumber() : 1;
        anomalies.push({
          severity: severityForRatio(ratio),
          indicator: `Budget "${budget.name}" — dépassement de ligne`,
          period: { from: execution.startDate.toISOString(), to: execution.endDate.toISOString() },
          observedValue: fmtDecimal(line.actual),
          referenceValue: fmtDecimal(line.planned),
          explanation: `Le montant réalisé (${fmtDecimal(line.actual)}) dépasse le montant prévu (${fmtDecimal(line.planned)}) pour cette ligne du budget "${budget.name}".`,
          recommendation: "Vérifier les dépenses rattachées à cette ligne et ajuster le budget si l'écart est justifié.",
          resourceType: "budget-line",
          resourceId: line.lineId,
        });
      }
    }
    return anomalies;
  }
}
