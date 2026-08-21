import { useQuery } from "@tanstack/react-query";

import * as hospitalityInsightsService from "../services/hospitality-insights.js";
import type { HospitalityInsightsParams } from "../services/hospitality-insights.js";

// Même principe que useFinanceSummary : pas de garde de permission côté client, le backend reste
// l'autorité (reservations.view) — un 403 réel remonte via QueryState.
export function useOccupancySummary(params?: HospitalityInsightsParams) {
  return useQuery({
    queryKey: ["hospitality-insights", "occupancy", params ?? null],
    queryFn: () => hospitalityInsightsService.getOccupancySummary(params),
  });
}
