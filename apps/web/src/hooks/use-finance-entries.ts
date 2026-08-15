import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as financeEntries from "../services/finance-entries.js";

export function useFinancialCategories() {
  return useQuery({ queryKey: ["financial-categories"], queryFn: financeEntries.listFinancialCategories });
}

export function useCashAccounts() {
  return useQuery({ queryKey: ["cash-accounts"], queryFn: financeEntries.listCashAccounts });
}

export function useRevenues() {
  return useQuery({ queryKey: ["revenues"], queryFn: financeEntries.listRevenues });
}

export function useCreateRevenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeEntries.createRevenue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      queryClient.invalidateQueries({ queryKey: ["finance", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-accounts"] });
    },
  });
}

export function useExpenses() {
  return useQuery({ queryKey: ["expenses"], queryFn: financeEntries.listExpenses });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: financeEntries.createExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

function useExpenseTransition(mutationFn: (id: string) => Promise<financeEntries.Expense>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-accounts"] });
    },
  });
}

export function useSubmitExpense() {
  return useExpenseTransition(financeEntries.submitExpense);
}
export function useApproveExpense() {
  return useExpenseTransition(financeEntries.approveExpense);
}
export function useMarkExpensePaid() {
  return useExpenseTransition(financeEntries.markExpensePaid);
}
