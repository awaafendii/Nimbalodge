import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as bankAccountsService from "../services/bank-accounts.js";
import type {
  CreateBankAccountInput,
  CreateBankTransactionInput,
  UpdateBankAccountInput,
} from "../services/bank-accounts.js";

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank-accounts"],
    queryFn: bankAccountsService.listBankAccounts,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBankAccountInput) => bankAccountsService.createBankAccount(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }),
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBankAccountInput }) =>
      bankAccountsService.updateBankAccount(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }),
  });
}

export function useBankTransactions(bankAccountId: string | null) {
  return useQuery({
    queryKey: ["bank-accounts", bankAccountId, "transactions"],
    queryFn: () => bankAccountsService.listBankTransactions(bankAccountId!),
    enabled: bankAccountId !== null,
  });
}

export function useCreateBankTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bankAccountId, input }: { bankAccountId: string; input: CreateBankTransactionInput }) =>
      bankAccountsService.createBankTransaction(bankAccountId, input),
    onSuccess: (_, { bankAccountId }) => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", bankAccountId, "transactions"] });
    },
  });
}
