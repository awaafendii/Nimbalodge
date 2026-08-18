import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateRevenueDto } from "./dto/create-revenue.dto";
import { RevenuesService } from "./revenues.service";

@Controller("revenues")
export class RevenuesController {
  constructor(private readonly revenuesService: RevenuesService) {}

  @Get()
  @RequirePermissions("finance-revenues.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.revenuesService.list(user);
  }

  @Get(":id")
  @RequirePermissions("finance-revenues.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.revenuesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("finance-revenues.create")
  create(@Body() dto: CreateRevenueDto, @CurrentUser() user: AuthenticatedUser) {
    return this.revenuesService.create(dto, user);
  }
}
