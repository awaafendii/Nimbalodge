import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { UpdateGuestDto } from "./dto/update-guest.dto";
import { GuestsService } from "./guests.service";

@Controller("guests")
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  @RequirePermissions("guests.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.guestsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("guests.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.guestsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("guests.create")
  create(@Body() dto: CreateGuestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.guestsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("guests.update")
  update(@Param("id") id: string, @Body() dto: UpdateGuestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.guestsService.update(id, dto, user);
  }
}
