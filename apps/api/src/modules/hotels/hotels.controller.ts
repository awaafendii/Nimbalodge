import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateHotelDto } from "./dto/create-hotel.dto";
import { UpdateHotelDto } from "./dto/update-hotel.dto";
import { HotelsService } from "./hotels.service";

@Controller("hotels")
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @RequirePermissions("hotels.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.hotelsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("hotels.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hotelsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("hotels.create")
  create(@Body() dto: CreateHotelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hotelsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("hotels.update")
  update(@Param("id") id: string, @Body() dto: UpdateHotelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hotelsService.update(id, dto, user);
  }
}
