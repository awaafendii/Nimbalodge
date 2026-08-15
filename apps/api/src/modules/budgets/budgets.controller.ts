import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { BudgetsService } from "./budgets.service";
import { CreateBudgetLineDto } from "./dto/create-budget-line.dto";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";

@Controller("budgets")
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @RequirePermissions("finance.budget.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("finance.budget.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("finance.budget.create")
  create(@Body() dto: CreateBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("finance.budget.update")
  update(@Param("id") id: string, @Body() dto: UpdateBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.update(id, dto, user);
  }

  @Post(":id/lines")
  @RequirePermissions("finance.budget.update")
  addLine(@Param("id") id: string, @Body() dto: CreateBudgetLineDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.addLine(id, dto, user);
  }

  @Get(":id/execution")
  @RequirePermissions("finance.budget.view")
  getExecution(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.getExecution(id, user);
  }

  @Post(":id/check-overspend")
  @RequirePermissions("finance.budget.check-overspend")
  checkOverspendAlerts(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetsService.checkOverspendAlerts(id, user);
  }
}
