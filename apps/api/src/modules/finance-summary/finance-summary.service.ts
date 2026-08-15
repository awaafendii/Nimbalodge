import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { BankAccountsService } from "../bank-accounts/bank-accounts.service";
import { CashAccountsService } from "../cash-accounts/cash-accounts.service";
import { FinanceSummaryQueryDto } from "./dto/finance-summary-query.dto";

// Dashboard financier minimal (§10) — un seul endpoint de lecture. Le reporting détaillé
// (comparaisons multi-période, export) reste Phase 11.
@Injectable()
export class FinanceSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashAccountsService: CashAccountsService,
    private readonly bankAccountsService: BankAccountsService
  ) {}

  async getSummary(query: FinanceSummaryQueryDto, requester: AuthenticatedUser) {
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const hotelWhere = requester.hotelId
      ? { hotelId: requester.hotelId }
      : { hotel: { organizationId: requester.organizationId } };

    const [revenueAgg, paymentAgg, expenseAgg, cashAccounts, bankAccounts] = await Promise.all([
      this.prisma.revenue.aggregate({
        where: { ...hotelWhere, date: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      }),
      // Phase 6 : les paiements de factures sont une 2e source de recette, distincte de Revenue
      // (voir docs/architecture/phase-6-billing.md, décision 3) — additionnée ici pour que le
      // dashboard ne sous-compte pas les recettes facturées.
      this.prisma.payment.aggregate({
        where: { invoice: hotelWhere, date: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { ...hotelWhere, status: { in: ["PAID", "BOOKED"] }, date: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      }),
      this.prisma.cashAccount.findMany({ where: hotelWhere }),
      this.prisma.bankAccount.findMany({ where: hotelWhere }),
    ]);

    let cashBalance = new Prisma.Decimal(0);
    for (const account of cashAccounts) {
      cashBalance = cashBalance.plus(await this.cashAccountsService.computeBalance(account.id, account.openingBalance));
    }

    let bankBalance = new Prisma.Decimal(0);
    for (const account of bankAccounts) {
      bankBalance = bankBalance.plus(await this.bankAccountsService.computeBalance(account.id, account.openingBalance));
    }

    const totalRevenue = (revenueAgg._sum.amount ?? new Prisma.Decimal(0)).plus(
      paymentAgg._sum.amount ?? new Prisma.Decimal(0)
    );

    return {
      period: { year, month },
      totalRevenue,
      totalExpense: expenseAgg._sum.amount ?? new Prisma.Decimal(0),
      cashBalance,
      bankBalance,
    };
  }
}
