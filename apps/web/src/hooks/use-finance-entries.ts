import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as financeEntries from "../services/finance-entries.js";

export function useFinancialCategories() {
  return useQuery({ queryKey: ["financial-categories"], queryFn: financeEntries.listFinancialCategories });
}

export function useCashAccounts() {
  return useQuery({ queryKey: ["cash-accounts"], queryFn: financeEntries.listCashAccounts });
}

export function useCreateCashAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: financeEntries.CreateCashAccountInput) => financeEntries.createCashAccount(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash-accounts"] }),
  });
}

export function useUpdateCashAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: financeEntries.UpdateCashAccountInput }) =>
      financeEntries.updateCashAccount(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash-accounts"] }),
  });
}

export function useCashTransactions(cashAccountId: string | null) {
  return useQuery({
    queryKey: ["cash-accounts", cashAccountId, "transactions"],
    queryFn: () => financeEntries.listCashTransactions(cashAccountId!),
    enabled: cashAccountId !== null,
  });
}

export function useCreateCashTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cashAccountId,
      input,
    }: {
      cashAccountId: string;
      input: financeEntries.CreateCashTransactionInput;
    }) => financeEntries.createCashTransaction(cashAccountId, input),
    onSuccess: (_, { cashAccountId }) => {
      queryClient.invalidateQueries({ queryKey: ["cash-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-accounts", cashAccountId, "transactions"] });
    },
  });
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
