import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as budgetsService from "../services/budgets.js";
import type { CreateBudgetInput, CreateBudgetLineInput } from "../services/budgets.js";

const BUDGETS_KEY = ["budgets"] as const;

export function useBudgets() {
  return useQuery({
    queryKey: BUDGETS_KEY,
    queryFn: budgetsService.listBudgets,
  });
}

export function useBudget(id: string | null) {
  return useQuery({
    queryKey: ["budgets", id],
    queryFn: () => budgetsService.getBudget(id!),
    enabled: id !== null,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBudgetInput) => budgetsService.createBudget(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
}

export function useAddBudgetLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, input }: { budgetId: string; input: CreateBudgetLineInput }) =>
      budgetsService.addBudgetLine(budgetId, input),
    onSuccess: (_, { budgetId }) => {
      queryClient.invalidateQueries({ queryKey: ["budgets", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["budgets", budgetId, "execution"] });
    },
  });
}

export function useBudgetExecution(id: string | null) {
  return useQuery({
    queryKey: ["budgets", id, "execution"],
    queryFn: () => budgetsService.getBudgetExecution(id!),
    enabled: id !== null,
  });
}

export function useCheckBudgetOverspend() {
  return useMutation({
    mutationFn: (id: string) => budgetsService.checkBudgetOverspend(id),
  });
}
