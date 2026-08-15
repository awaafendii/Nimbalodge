import { Module } from "@nestjs/common";

import { BankAccountsModule } from "../bank-accounts/bank-accounts.module";
import { CashAccountsModule } from "../cash-accounts/cash-accounts.module";
import { FinanceSummaryController } from "./finance-summary.controller";
import { FinanceSummaryService } from "./finance-summary.service";

@Module({
  imports: [CashAccountsModule, BankAccountsModule],
  controllers: [FinanceSummaryController],
  providers: [FinanceSummaryService],
})
export class FinanceSummaryModule {}
