import { useQuery } from "@tanstack/react-query";

import * as financeService from "../services/finance.js";
import type { FinanceSummaryParams } from "../services/finance.js";

// Pas de garde de permission côté client ici (contrairement au filtrage des items de nav) — le
// backend reste l'autorité (RBAC réel) ; un 403 réel remonte via QueryState plutôt que d'être
// anticipé/dupliqué côté frontend.
// `params` optionnel (mois/année) : réutilise le même endpoint pour aller chercher le mois
// précédent (calcul de tendance dans le bandeau KPI, Étape Écrans/KPI) plutôt que d'ajouter un
// nouvel endpoint de comparaison de période.
export function useFinanceSummary(params?: FinanceSummaryParams) {
  return useQuery({
    queryKey: ["finance", "summary", params ?? null],
    queryFn: () => financeService.getFinanceSummary(params),
  });
}
