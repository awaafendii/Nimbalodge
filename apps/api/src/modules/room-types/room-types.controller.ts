import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateRoomTypeDto } from "./dto/create-room-type.dto";
import { UpdateRoomTypeDto } from "./dto/update-room-type.dto";
import { RoomTypesService } from "./room-types.service";

@Controller("room-types")
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}

  @Get()
  @RequirePermissions("room-types.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.roomTypesService.list(user);
  }

  @Get(":id")
  @RequirePermissions("room-types.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.roomTypesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("room-types.create")
  create(@Body() dto: CreateRoomTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roomTypesService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("room-types.update")
  update(@Param("id") id: string, @Body() dto: UpdateRoomTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roomTypesService.update(id, dto, user);
  }
}
