import { apiClient } from "./api-client.js";
import type { PaymentMethod } from "./finance-entries.js";

export type PayslipStatus = "DRAFT" | "FINALIZED" | "PAID";

export interface Payslip {
  id: string;
  hotelId: string;
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  baseSalary: string;
  bonuses: string;
  overtimeAmount: string;
  absenceDeduction: string;
  advances: string;
  deductions: string;
  currency: string;
  status: PayslipStatus;
  expenseId: string | null;
  paidAt: string | null;
  createdById: string;
  netPay: string;
  createdAt: string;
}

export interface CreatePayslipInput {
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  bonuses?: number;
  overtimeAmount?: number;
  absenceDeduction?: number;
  advances?: number;
  deductions?: number;
  hotelId?: string;
}

export interface MarkPaidPayslipInput {
  cashAccountId?: string;
  bankAccountId?: string;
  paymentMethod: PaymentMethod;
  categoryId: string;
}

export function listPayslips(): Promise<Payslip[]> {
  return apiClient.get<Payslip[]>("/payslips");
}

export function createPayslip(input: CreatePayslipInput): Promise<Payslip> {
  return apiClient.post<Payslip>("/payslips", input);
}

export function finalizePayslip(id: string): Promise<Payslip> {
  return apiClient.post<Payslip>(`/payslips/${id}/finalize`);
}

export function markPaidPayslip(id: string, input: MarkPaidPayslipInput): Promise<Payslip> {
  return apiClient.post<Payslip>(`/payslips/${id}/mark-paid`, input);
}
