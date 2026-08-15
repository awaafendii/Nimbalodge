import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CashAccountsService } from "./cash-accounts.service";
import { CreateCashAccountDto } from "./dto/create-cash-account.dto";
import { CreateCashTransactionDto } from "./dto/create-cash-transaction.dto";
import { UpdateCashAccountDto } from "./dto/update-cash-account.dto";

@Controller("cash-accounts")
export class CashAccountsController {
  constructor(private readonly cashAccountsService: CashAccountsService) {}

  @Get()
  @RequirePermissions("finance.cash-account.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.cashAccountsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("finance.cash-account.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cashAccountsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("finance.cash-account.create")
  create(@Body() dto: CreateCashAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cashAccountsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("finance.cash-account.update")
  update(@Param("id") id: string, @Body() dto: UpdateCashAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cashAccountsService.update(id, dto, user);
  }

  @Get(":id/transactions")
  @RequirePermissions("finance.cash-account.view")
  listTransactions(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cashAccountsService.listTransactions(id, user);
  }

  @Post(":id/transactions")
  @RequirePermissions("finance.cash-account.update")
  addTransaction(
    @Param("id") id: string,
    @Body() dto: CreateCashTransactionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.cashAccountsService.addTransaction(id, dto, user);
  }
}
