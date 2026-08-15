import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateWorkScheduleDto } from "./dto/create-work-schedule.dto";
import { UpdateWorkScheduleDto } from "./dto/update-work-schedule.dto";
import { WorkSchedulesService } from "./work-schedules.service";

@Controller("work-schedules")
export class WorkSchedulesController {
  constructor(private readonly workSchedulesService: WorkSchedulesService) {}

  @Get()
  @RequirePermissions("work-schedules.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workSchedulesService.list(user);
  }

  @Get(":id")
  @RequirePermissions("work-schedules.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workSchedulesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("work-schedules.create")
  create(@Body() dto: CreateWorkScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workSchedulesService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("work-schedules.update")
  update(@Param("id") id: string, @Body() dto: UpdateWorkScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workSchedulesService.update(id, dto, user);
  }
}
