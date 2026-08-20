import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { CashAccountsService } from "../../cash-accounts/cash-accounts.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { Anomaly } from "../anomaly";
import type { AnomalyDetector } from "./anomaly-detector.interface";
import { fmtDecimal, severityForRatio } from "./severity";

// Sortie de caisse (direction "OUT") dont le montant dépasse nettement la moyenne des sorties de
// la période précédente sur la même caisse. Caisses uniquement pour cette v1 (comptes bancaires
// hors périmètre — voir plan Nimba AI), réutilise CashAccountsService.list()/listTransactions()
// tels quels, aucun recalcul de solde.
const OUTLIER_RATIO = 1; // transaction ≥ 2x la moyenne historique des sorties

@Injectable()
export class CashAnomalyDetector implements AnomalyDetector {
  readonly source = "cash-anomaly";
  readonly requiredPermission = "finance-cash-accounts.view";

  constructor(private readonly cashAccountsService: CashAccountsService) {}

  async detect(requester: AuthenticatedUser, dateFrom: Date, dateTo: Date): Promise<Anomaly[]> {
    const accounts = await this.cashAccountsService.list(requester);
    const periodLengthMs = dateTo.getTime() - dateFrom.getTime();
    const previousDateFrom = new Date(dateFrom.getTime() - periodLengthMs);
    const period = { from: dateFrom.toISOString(), to: dateTo.toISOString() };

    const anomalies: Anomaly[] = [];
    for (const account of accounts) {
      const transactions = await this.cashAccountsService.listTransactions(account.id, requester);
      const outTransactions = transactions.filter((transaction) => transaction.direction === "OUT");
      const previousOut = outTransactions.filter((transaction) => transaction.date >= previousDateFrom && transaction.date < dateFrom);
      const currentOut = outTransactions.filter((transaction) => transaction.date >= dateFrom && transaction.date < dateTo);
      // Pas de sorties sur la période précédente -> aucune référence fiable, jamais d'anomalie
      // inventée faute de comparaison possible.
      if (previousOut.length === 0 || currentOut.length === 0) continue;

      const averagePrevious = previousOut
        .reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0))
        .dividedBy(previousOut.length);
      if (averagePrevious.lessThanOrEqualTo(0)) continue;

      for (const transaction of currentOut) {
        const ratio = transaction.amount.minus(averagePrevious).dividedBy(averagePrevious).toNumber();
        if (ratio < OUTLIER_RATIO) continue;
        anomalies.push({
          severity: severityForRatio(ratio),
          indicator: `Caisse "${account.name}" — sortie inhabituelle`,
          period,
          observedValue: fmtDecimal(transaction.amount),
          referenceValue: fmtDecimal(averagePrevious),
          explanation: `Une sortie de caisse de ${fmtDecimal(transaction.amount)} ("${transaction.label}") sur la caisse "${account.name}" est nettement supérieure à la moyenne des sorties de la période précédente (${fmtDecimal(averagePrevious)}).`,
          recommendation: "Vérifier le justificatif de cette sortie de caisse.",
          resourceType: "cash-transaction",
          resourceId: transaction.id,
        });
      }
    }

    return anomalies;
  }
}
