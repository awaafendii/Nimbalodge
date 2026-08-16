import { apiClient } from "./api-client.js";

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

export function listBankAccounts(): Promise<BankAccount[]> {
  return apiClient.get<BankAccount[]>("/bank-accounts");
}
