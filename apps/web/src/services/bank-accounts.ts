import { apiClient } from "./api-client.js";
import type { TransactionDirection } from "./finance-entries.js";

export interface BankAccount {
  id: string;
  hotelId: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  openingBalance: string;
  currency: string;
  managerId: string | null;
  isActive: boolean;
  balance: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
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

export interface CreateBankAccountInput {
  name: string;
  bankName?: string;
  accountNumber?: string;
  openingBalance?: number;
  currency?: string;
  managerId?: string;
  hotelId?: string;
}

export interface UpdateBankAccountInput {
  name?: string;
  bankName?: string;
  accountNumber?: string;
  managerId?: string;
  isActive?: boolean;
}

export interface CreateBankTransactionInput {
  direction: TransactionDirection;
  amount: number;
  label: string;
  date?: string;
}

export function listBankAccounts(): Promise<BankAccount[]> {
  return apiClient.get<BankAccount[]>("/bank-accounts");
}

export function createBankAccount(input: CreateBankAccountInput): Promise<BankAccount> {
  return apiClient.post<BankAccount>("/bank-accounts", input);
}

export function updateBankAccount(id: string, input: UpdateBankAccountInput): Promise<BankAccount> {
  return apiClient.patch<BankAccount>(`/bank-accounts/${id}`, input);
}

export function listBankTransactions(bankAccountId: string): Promise<BankTransaction[]> {
  return apiClient.get<BankTransaction[]>(`/bank-accounts/${bankAccountId}/transactions`);
}

export function createBankTransaction(
  bankAccountId: string,
  input: CreateBankTransactionInput
): Promise<BankTransaction> {
  return apiClient.post<BankTransaction>(`/bank-accounts/${bankAccountId}/transactions`, input);
}
