import { useQuery } from "@tanstack/react-query";

import * as financeService from "../services/finance.js";

// Pas de garde de permission côté client ici (contrairement au filtrage des items de nav) — le
// backend reste l'autorité (RBAC réel) ; un 403 réel remonte via QueryState plutôt que d'être
// anticipé/dupliqué côté frontend.
export function useFinanceSummary() {
  return useQuery({
    queryKey: ["finance", "summary"],
    queryFn: financeService.getFinanceSummary,
  });
}
