import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { RejectExpenseDto } from "./dto/reject-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { ExpensesService } from "./expenses.service";

@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequirePermissions("finance-expenses.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.list(user);
  }

  @Get(":id")
  @RequirePermissions("finance-expenses.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("finance-expenses.create")
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("finance-expenses.update")
  update(@Param("id") id: string, @Body() dto: UpdateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.update(id, dto, user);
  }

  @Post(":id/submit")
  @RequirePermissions("finance-expenses.submit")
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.submit(id, user);
  }

  @Post(":id/approve")
  @RequirePermissions("finance-expenses.approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.approve(id, user);
  }

  @Post(":id/reject")
  @RequirePermissions("finance-expenses.approve")
  reject(@Param("id") id: string, @Body() dto: RejectExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.reject(id, dto, user);
  }

  @Post(":id/mark-paid")
  @RequirePermissions("finance-expenses.pay")
  markPaid(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.markPaid(id, user);
  }

  @Post(":id/book")
  @RequirePermissions("finance-expenses.book")
  book(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.book(id, user);
  }
}
