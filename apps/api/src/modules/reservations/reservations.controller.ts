import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CancelReservationDto } from "./dto/cancel-reservation.dto";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { UpdateReservationDto } from "./dto/update-reservation.dto";
import { ReservationsService } from "./reservations.service";

@Controller("reservations")
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @RequirePermissions("reservations.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("reservations.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("reservations.create")
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("reservations.update")
  update(@Param("id") id: string, @Body() dto: UpdateReservationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.update(id, dto, user);
  }

  @Post(":id/confirm")
  @RequirePermissions("reservations.confirm")
  confirm(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.confirm(id, user);
  }

  @Post(":id/check-in")
  @RequirePermissions("reservations.check-in")
  checkIn(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.checkIn(id, user);
  }

  @Post(":id/check-out")
  @RequirePermissions("reservations.check-out")
  checkOut(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.checkOut(id, user);
  }

  @Post(":id/cancel")
  @RequirePermissions("reservations.cancel")
  cancel(@Param("id") id: string, @Body() dto: CancelReservationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.cancel(id, dto, user);
  }

  @Post(":id/no-show")
  @RequirePermissions("reservations.no-show")
  noShow(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.noShow(id, user);
  }
}
