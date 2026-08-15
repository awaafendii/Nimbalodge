import type { CashAccount } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

// `balance` sérialise en string (précision Decimal préservée, pas de perte flottante) — voir
// docs/architecture/phase-5-finance.md.
export function toCashAccountResponse(account: CashAccount, balance: Decimal) {
  return {
    id: account.id,
    hotelId: account.hotelId,
    name: account.name,
    code: account.code,
    openingBalance: account.openingBalance,
    currency: account.currency,
    managerId: account.managerId,
    isActive: account.isActive,
    balance,
    createdAt: account.createdAt,
  };
}
