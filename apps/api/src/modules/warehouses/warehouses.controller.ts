import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { WarehousesService } from "./warehouses.service";

@Controller("warehouses")
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermissions("warehouses.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.warehousesService.list(user);
  }

  @Get(":id")
  @RequirePermissions("warehouses.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.warehousesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("warehouses.create")
  create(@Body() dto: CreateWarehouseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.warehousesService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("warehouses.update")
  update(@Param("id") id: string, @Body() dto: UpdateWarehouseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.warehousesService.update(id, dto, user);
  }
}
