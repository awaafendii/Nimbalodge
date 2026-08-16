import { apiClient } from "./api-client.js";
import type { PaymentMethod } from "./finance-entries.js";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
export type ClientType = "INDIVIDUAL" | "COMPANY";

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
  lineTotal: string;
}

export interface Invoice {
  id: string;
  hotelId: string;
  departmentId: string | null;
  activityId: string | null;
  costCenterId: string | null;
  categoryId: string;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  clientName: string;
  clientType: ClientType | null;
  clientContact: string | null;
  clientAddress: string | null;
  guestId: string | null;
  reservationId: string | null;
  createdById: string;
  lines: InvoiceLine[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  amountPaid: string;
  amountCredited: string;
  dueBalance: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: string;
  paymentMethod: PaymentMethod;
  date: string;
  cashAccountId: string | null;
  bankAccountId: string | null;
  reference: string | null;
  createdById: string;
  createdAt: string;
}

export interface CreditNote {
  id: string;
  invoiceId: string;
  amount: string;
  reason: string | null;
  date: string;
  cashAccountId: string | null;
  bankAccountId: string | null;
  createdById: string;
  createdAt: string;
}

export interface CreateInvoiceLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  taxRate?: number;
}

export interface CreateInvoiceInput {
  categoryId: string;
  clientName: string;
  clientType?: ClientType;
  clientContact?: string;
  clientAddress?: string;
  dueDate?: string;
  lines: CreateInvoiceLineInput[];
  hotelId?: string;
}

export interface CreatePaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  date?: string;
  cashAccountId?: string;
  bankAccountId?: string;
  reference?: string;
}

export interface CreateCreditNoteInput {
  amount: number;
  reason?: string;
  date?: string;
  cashAccountId?: string;
  bankAccountId?: string;
}

export function listInvoices(): Promise<Invoice[]> {
  return apiClient.get<Invoice[]>("/invoices");
}

export function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  return apiClient.post<Invoice>("/invoices", input);
}

export function issueInvoice(id: string): Promise<Invoice> {
  return apiClient.post<Invoice>(`/invoices/${id}/issue`);
}

export function cancelInvoice(id: string): Promise<Invoice> {
  return apiClient.post<Invoice>(`/invoices/${id}/cancel`);
}

export function listPayments(invoiceId: string): Promise<Payment[]> {
  return apiClient.get<Payment[]>(`/invoices/${invoiceId}/payments`);
}

export function createPayment(invoiceId: string, input: CreatePaymentInput): Promise<Payment> {
  return apiClient.post<Payment>(`/invoices/${invoiceId}/payments`, input);
}

export function listCreditNotes(invoiceId: string): Promise<CreditNote[]> {
  return apiClient.get<CreditNote[]>(`/invoices/${invoiceId}/credit-notes`);
}

export function createCreditNote(invoiceId: string, input: CreateCreditNoteInput): Promise<CreditNote> {
  return apiClient.post<CreditNote>(`/invoices/${invoiceId}/credit-notes`, input);
}
