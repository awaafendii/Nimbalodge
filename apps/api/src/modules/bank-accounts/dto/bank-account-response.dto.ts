import type { BankAccount } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

export function toBankAccountResponse(account: BankAccount, balance: Decimal) {
  return {
    id: account.id,
    hotelId: account.hotelId,
    name: account.name,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    openingBalance: account.openingBalance,
    currency: account.currency,
    managerId: account.managerId,
    isActive: account.isActive,
    balance,
    createdAt: account.createdAt,
  };
}
