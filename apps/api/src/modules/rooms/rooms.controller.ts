import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateRoomDto } from "./dto/create-room.dto";
import { RoomAvailabilityQueryDto } from "./dto/room-availability-query.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @RequirePermissions("rooms.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.roomsService.list(user);
  }

  // Route statique déclarée AVANT ":id" — sinon Nest matcherait "available" comme un :id.
  @Get("available")
  @RequirePermissions("rooms.view")
  available(@Query() query: RoomAvailabilityQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roomsService.available(query, user);
  }

  @Get(":id")
  @RequirePermissions("rooms.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.roomsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("rooms.create")
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roomsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("rooms.update")
  update(@Param("id") id: string, @Body() dto: UpdateRoomDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roomsService.update(id, dto, user);
  }
}
