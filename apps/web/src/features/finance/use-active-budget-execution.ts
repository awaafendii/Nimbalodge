import { useMemo } from "react";

import { useBudgetExecution, useBudgets } from "../../hooks/use-budgets.js";
import type { BudgetExecutionLine } from "../../services/budgets.js";

// Logique "budget actif" partagée entre Finance → Budget, Finance → Dépenses (alerte de
// dépassement) et le tableau de bord Finance global — extraite ici pour ne plus la dupliquer
// (3e usage). "Budget actif" = premier budget isActive dont la période couvre aujourd'hui ; en cas
// de chevauchement, le premier créé (ordre déjà trié côté API) est retenu — limite documentée, pas
// de sélecteur pour l'instant.
export function useActiveBudgetExecution() {
  const budgets = useBudgets();
  const now = new Date();
  const activeBudget = useMemo(() => {
    if (!budgets.data) return null;
    return (
      budgets.data.find((budget) => {
        if (!budget.isActive) return false;
        return new Date(budget.startDate) <= now && now <= new Date(budget.endDate);
      }) ?? null
    );
  }, [budgets.data, now]);

  const execution = useBudgetExecution(activeBudget?.id ?? null);

  const summary = useMemo(() => {
    if (!execution.data) return null;
    let planned = 0;
    let actual = 0;
    const overspentLines: BudgetExecutionLine[] = [];
    for (const line of execution.data.lines) {
      planned += Number(line.planned);
      actual += Number(line.actual);
      if (line.type === "EXPENSE" && Number(line.actual) > Number(line.planned)) {
        overspentLines.push(line);
      }
    }
    const variance = planned - actual;
    const executionRate = planned > 0 ? (actual / planned) * 100 : 0;
    return { planned, actual, variance, executionRate, overspentLines };
  }, [execution.data]);

  return { budgetsLoading: budgets.isLoading, activeBudget, executionLoading: execution.isLoading, summary };
}
