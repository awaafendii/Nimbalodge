import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { BankAccountsService } from "./bank-accounts.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { CreateBankTransactionDto } from "./dto/create-bank-transaction.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";

@Controller("bank-accounts")
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  @RequirePermissions("finance.bank-account.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("finance.bank-account.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("finance.bank-account.create")
  create(@Body() dto: CreateBankAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("finance.bank-account.update")
  update(@Param("id") id: string, @Body() dto: UpdateBankAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.update(id, dto, user);
  }

  @Get(":id/transactions")
  @RequirePermissions("finance.bank-account.view")
  listTransactions(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.listTransactions(id, user);
  }

  @Post(":id/transactions")
  @RequirePermissions("finance.bank-account.update")
  addTransaction(
    @Param("id") id: string,
    @Body() dto: CreateBankTransactionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bankAccountsService.addTransaction(id, dto, user);
  }
}
