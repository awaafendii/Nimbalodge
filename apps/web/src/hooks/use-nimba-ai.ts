import { useQuery } from "@tanstack/react-query";

import * as nimbaAiService from "../services/nimba-ai.js";
import type { AiMonthFilters, AiPeriodFilters } from "../services/nimba-ai.js";

// Chaque insight est indépendant (permission distincte côté backend, voir
// apps/api/src/modules/nimba-ai) : un échec (403) sur l'un ne doit jamais empêcher les autres de
// se charger normalement -- chaque hook gère son propre état, jamais combinés en une seule requête.

export function useFinanceInsights(filters: AiMonthFilters = {}) {
  return useQuery({
    queryKey: ["nimba-ai", "insights", "finance", filters],
    queryFn: () => nimbaAiService.getFinanceInsights(filters),
  });
}

export function useDepartmentInsights(filters: AiPeriodFilters = {}) {
  return useQuery({
    queryKey: ["nimba-ai", "insights", "department", filters],
    queryFn: () => nimbaAiService.getDepartmentInsights(filters),
  });
}

export function useHospitalityInsights(filters: AiPeriodFilters = {}) {
  return useQuery({
    queryKey: ["nimba-ai", "insights", "hospitality", filters],
    queryFn: () => nimbaAiService.getHospitalityInsights(filters),
  });
}

export function useHrWorkforceInsights(filters: AiPeriodFilters = {}) {
  return useQuery({
    queryKey: ["nimba-ai", "insights", "hr-workforce", filters],
    queryFn: () => nimbaAiService.getHrWorkforceInsights(filters),
  });
}

export function useHrPayrollInsights(filters: AiPeriodFilters = {}) {
  return useQuery({
    queryKey: ["nimba-ai", "insights", "hr-payroll", filters],
    queryFn: () => nimbaAiService.getHrPayrollInsights(filters),
  });
}
