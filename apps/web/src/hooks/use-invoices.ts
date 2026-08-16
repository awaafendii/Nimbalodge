import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as invoicesService from "../services/invoices.js";
import type { CreateCreditNoteInput, CreateInvoiceInput, CreatePaymentInput } from "../services/invoices.js";

const INVOICES_KEY = ["invoices"] as const;

export function useInvoices() {
  return useQuery({
    queryKey: INVOICES_KEY,
    queryFn: invoicesService.listInvoices,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => invoicesService.createInvoice(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVOICES_KEY }),
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesService.issueInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVOICES_KEY }),
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesService.cancelInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVOICES_KEY }),
  });
}

export function usePayments(invoiceId: string | null) {
  return useQuery({
    queryKey: ["invoices", invoiceId, "payments"],
    queryFn: () => invoicesService.listPayments(invoiceId!),
    enabled: invoiceId !== null,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, input }: { invoiceId: string; input: CreatePaymentInput }) =>
      invoicesService.createPayment(invoiceId, input),
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["cash-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });
}

export function useCreditNotes(invoiceId: string | null) {
  return useQuery({
    queryKey: ["invoices", invoiceId, "credit-notes"],
    queryFn: () => invoicesService.listCreditNotes(invoiceId!),
    enabled: invoiceId !== null,
  });
}

export function useCreateCreditNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, input }: { invoiceId: string; input: CreateCreditNoteInput }) =>
      invoicesService.createCreditNote(invoiceId, input),
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId, "credit-notes"] });
      queryClient.invalidateQueries({ queryKey: ["cash-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });
}
