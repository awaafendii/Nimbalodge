import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as payslipsService from "../services/payslips.js";
import type { CreatePayslipInput, MarkPaidPayslipInput } from "../services/payslips.js";

const PAYSLIPS_KEY = ["payslips"] as const;

export function usePayslips() {
  return useQuery({
    queryKey: PAYSLIPS_KEY,
    queryFn: payslipsService.listPayslips,
  });
}

export function useCreatePayslip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePayslipInput) => payslipsService.createPayslip(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYSLIPS_KEY }),
  });
}

export function useFinalizePayslip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payslipsService.finalizePayslip(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYSLIPS_KEY }),
  });
}

export function useMarkPaidPayslip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MarkPaidPayslipInput }) =>
      payslipsService.markPaidPayslip(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYSLIPS_KEY });
      queryClient.invalidateQueries({ queryKey: ["cash-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });
}
