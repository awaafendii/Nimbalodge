import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { DataMinimizer } from "./data-minimizer.interface";

export interface FinanceSummaryRaw {
  period: { year: number; month: number };
  totalRevenue: Prisma.Decimal;
  totalExpense: Prisma.Decimal;
  cashBalance: Prisma.Decimal;
  bankBalance: Prisma.Decimal;
}

export interface FinanceSummaryMinimized {
  period: { year: number; month: number };
  totalRevenue: string;
  totalExpense: string;
  cashBalance: string;
  bankBalance: string;
}

// Le résumé financier est déjà entièrement agrégé (aucune ligne individuelle, aucune donnée
// personnelle) — la minimisation se limite ici à convertir les montants Decimal en string, seule
// forme jamais renvoyée par l'API pour un montant (voir docs/business-rules/finance.md §1).
@Injectable()
export class FinanceInsightsMinimizer implements DataMinimizer<FinanceSummaryRaw, FinanceSummaryMinimized> {
  minimize(raw: FinanceSummaryRaw): FinanceSummaryMinimized {
    return {
      period: raw.period,
      totalRevenue: raw.totalRevenue.toString(),
      totalExpense: raw.totalExpense.toString(),
      cashBalance: raw.cashBalance.toString(),
      bankBalance: raw.bankBalance.toString(),
    };
  }
}
