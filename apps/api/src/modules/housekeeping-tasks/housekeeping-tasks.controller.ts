import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateHousekeepingTaskDto } from "./dto/create-housekeeping-task.dto";
import { HousekeepingTasksService } from "./housekeeping-tasks.service";

@Controller("housekeeping-tasks")
export class HousekeepingTasksController {
  constructor(private readonly housekeepingTasksService: HousekeepingTasksService) {}

  @Get()
  @RequirePermissions("housekeeping-tasks.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.housekeepingTasksService.list(user);
  }

  // Route statique déclarée AVANT /:id — sinon Nest matcherait "dashboard" comme un id.
  @Get("dashboard")
  @RequirePermissions("housekeeping-tasks.view")
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.housekeepingTasksService.dashboard(user);
  }

  @Get(":id")
  @RequirePermissions("housekeeping-tasks.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.housekeepingTasksService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("housekeeping-tasks.create")
  create(@Body() dto: CreateHousekeepingTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.housekeepingTasksService.create(dto, user);
  }

  @Post(":id/clean")
  @RequirePermissions("housekeeping-tasks.clean")
  clean(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.housekeepingTasksService.clean(id, user);
  }

  @Post(":id/inspect")
  @RequirePermissions("housekeeping-tasks.inspect")
  inspect(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.housekeepingTasksService.inspect(id, user);
  }
}
