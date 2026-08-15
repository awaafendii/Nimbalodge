import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CostCentersService } from "./cost-centers.service";
import { CreateCostCenterDto } from "./dto/create-cost-center.dto";
import { UpdateCostCenterDto } from "./dto/update-cost-center.dto";

@Controller("cost-centers")
export class CostCentersController {
  constructor(private readonly costCentersService: CostCentersService) {}

  @Get()
  @RequirePermissions("cost-centers.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.costCentersService.list(user);
  }

  @Get(":id")
  @RequirePermissions("cost-centers.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.costCentersService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("cost-centers.create")
  create(@Body() dto: CreateCostCenterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.costCentersService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("cost-centers.update")
  update(@Param("id") id: string, @Body() dto: UpdateCostCenterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.costCentersService.update(id, dto, user);
  }
}
