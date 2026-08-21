import { Module } from "@nestjs/common";

import { BankAccountsModule } from "../bank-accounts/bank-accounts.module";
import { CashAccountsModule } from "../cash-accounts/cash-accounts.module";
import { DepartmentsModule } from "../departments/departments.module";
import { FinanceSummaryController } from "./finance-summary.controller";
import { FinanceSummaryService } from "./finance-summary.service";

@Module({
  imports: [CashAccountsModule, BankAccountsModule, DepartmentsModule],
  controllers: [FinanceSummaryController],
  providers: [FinanceSummaryService],
  // Exporté pour Nimba AI (FinanceInsightsTool, Étape 4) — réutilise getSummary() directement
  // plutôt que de dupliquer sa logique d'agrégation/scope.
  exports: [FinanceSummaryService],
})
export class FinanceSummaryModule {}
