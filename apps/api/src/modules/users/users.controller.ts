import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { AddHotelMembershipDto } from "./dto/add-hotel-membership.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions("users.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.list(user);
  }

  @Get(":id")
  @RequirePermissions("users.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("users.create")
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.create(dto, user);
  }

  // Constitue un profil multi-hôtel (type BOSS) progressivement depuis l'application — même
  // permission que create() (gérer qui a accès à un hôtel est la même capacité que créer un
  // utilisateur, pas une permission distincte).
  @Post(":id/hotel-memberships")
  @RequirePermissions("users.create")
  addHotelMembership(@Param("id") id: string, @Body() dto: AddHotelMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.addHotelMembership(id, dto, user);
  }

  @Delete(":id/hotel-memberships/:hotelId")
  @RequirePermissions("users.create")
  removeHotelMembership(@Param("id") id: string, @Param("hotelId") hotelId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.removeHotelMembership(id, hotelId, user);
  }
}
