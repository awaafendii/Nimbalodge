import { apiClient } from "./api-client.js";

// Montants sérialisés en chaîne par l'API (Decimal.toJSON(), voir apps/api) — jamais reconverti en
// number côté service, seulement à l'affichage (fmtGNF côté composant).
export interface FinanceSummary {
  period: { year: number; month: number };
  totalRevenue: string;
  totalExpense: string;
  cashBalance: string;
  bankBalance: string;
}

export function getFinanceSummary(): Promise<FinanceSummary> {
  return apiClient.get<FinanceSummary>("/finance/summary");
}
