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

export interface FinanceSummaryParams {
  month?: number;
  year?: number;
}

export function getFinanceSummary(params?: FinanceSummaryParams): Promise<FinanceSummary> {
  const query = new URLSearchParams();
  if (params?.month) query.set("month", String(params.month));
  if (params?.year) query.set("year", String(params.year));
  const qs = query.toString();
  return apiClient.get<FinanceSummary>(`/finance/summary${qs ? `?${qs}` : ""}`);
}
