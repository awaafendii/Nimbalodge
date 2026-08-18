import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateFinancialCategoryDto } from "./dto/create-financial-category.dto";
import { UpdateFinancialCategoryDto } from "./dto/update-financial-category.dto";
import { FinancialCategoriesService } from "./financial-categories.service";

@Controller("financial-categories")
export class FinancialCategoriesController {
  constructor(private readonly financialCategoriesService: FinancialCategoriesService) {}

  @Get()
  @RequirePermissions("finance-categories.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.financialCategoriesService.list(user);
  }

  @Get(":id")
  @RequirePermissions("finance-categories.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.financialCategoriesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("finance-categories.create")
  create(@Body() dto: CreateFinancialCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.financialCategoriesService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("finance-categories.update")
  update(@Param("id") id: string, @Body() dto: UpdateFinancialCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.financialCategoriesService.update(id, dto, user);
  }
}
