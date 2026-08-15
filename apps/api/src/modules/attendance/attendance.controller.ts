import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { AttendanceService } from "./attendance.service";
import { CreateAttendanceDto } from "./dto/create-attendance.dto";

@Controller("attendances")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequirePermissions("attendance.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.list(user);
  }

  @Get(":id")
  @RequirePermissions("attendance.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("attendance.create")
  create(@Body() dto: CreateAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.create(dto, user);
  }

  @Post(":id/clock-out")
  @RequirePermissions("attendance.clock-out")
  clockOut(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.clockOut(id, user);
  }
}
