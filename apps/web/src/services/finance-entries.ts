import { apiClient } from "./api-client.js";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CARD" | "CHECK" | "OTHER";
export type ExpenseStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "BOOKED";

export interface FinancialCategory {
  id: string;
  hotelId: string;
  type: "REVENUE" | "EXPENSE";
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CashAccount {
  id: string;
  hotelId: string;
  name: string;
  code: string | null;
  openingBalance: string;
  currency: string;
  managerId: string | null;
  isActive: boolean;
  balance: string;
  createdAt: string;
}

export type TransactionDirection = "IN" | "OUT";

export interface CashTransaction {
  id: string;
  cashAccountId: string;
  direction: TransactionDirection;
  amount: string;
  label: string;
  date: string;
  revenueId: string | null;
  expenseId: string | null;
  paymentId: string | null;
  creditNoteId: string | null;
  createdById: string;
  createdAt: string;
}

export interface CreateCashAccountInput {
  name: string;
  code?: string;
  openingBalance?: number;
  currency?: string;
  managerId?: string;
  hotelId?: string;
}

export interface UpdateCashAccountInput {
  name?: string;
  code?: string;
  managerId?: string;
  isActive?: boolean;
}

export interface CreateCashTransactionInput {
  direction: TransactionDirection;
  amount: number;
  label: string;
  date?: string;
}

export interface Revenue {
  id: string;
  hotelId: string;
  categoryId: string;
  amount: string;
  currency: string;
  date: string;
  paymentMethod: PaymentMethod;
  cashAccountId: string | null;
  bankAccountId: string | null;
  reference: string | null;
  createdAt: string;
}

export interface Expense {
  id: string;
  hotelId: string;
  categoryId: string;
  amount: string;
  currency: string;
  date: string;
  vendorName: string | null;
  paymentMethod: PaymentMethod;
  cashAccountId: string | null;
  bankAccountId: string | null;
  status: ExpenseStatus;
  createdAt: string;
}

export function listFinancialCategories(): Promise<FinancialCategory[]> {
  return apiClient.get<FinancialCategory[]>("/financial-categories");
}

export function listCashAccounts(): Promise<CashAccount[]> {
  return apiClient.get<CashAccount[]>("/cash-accounts");
}

export function createCashAccount(input: CreateCashAccountInput): Promise<CashAccount> {
  return apiClient.post<CashAccount>("/cash-accounts", input);
}

export function updateCashAccount(id: string, input: UpdateCashAccountInput): Promise<CashAccount> {
  return apiClient.patch<CashAccount>(`/cash-accounts/${id}`, input);
}

export function listCashTransactions(cashAccountId: string): Promise<CashTransaction[]> {
  return apiClient.get<CashTransaction[]>(`/cash-accounts/${cashAccountId}/transactions`);
}

export function createCashTransaction(
  cashAccountId: string,
  input: CreateCashTransactionInput
): Promise<CashTransaction> {
  return apiClient.post<CashTransaction>(`/cash-accounts/${cashAccountId}/transactions`, input);
}

export function listRevenues(): Promise<Revenue[]> {
  return apiClient.get<Revenue[]>("/revenues");
}

export function createRevenue(input: {
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  cashAccountId: string;
}): Promise<Revenue> {
  return apiClient.post<Revenue>("/revenues", input);
}

export function listExpenses(): Promise<Expense[]> {
  return apiClient.get<Expense[]>("/expenses");
}

export function createExpense(input: {
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  cashAccountId: string;
  vendorName?: string;
}): Promise<Expense> {
  return apiClient.post<Expense>("/expenses", input);
}

export function submitExpense(id: string): Promise<Expense> {
  return apiClient.post<Expense>(`/expenses/${id}/submit`);
}

export function approveExpense(id: string): Promise<Expense> {
  return apiClient.post<Expense>(`/expenses/${id}/approve`);
}

export function markExpensePaid(id: string): Promise<Expense> {
  return apiClient.post<Expense>(`/expenses/${id}/mark-paid`);
}
