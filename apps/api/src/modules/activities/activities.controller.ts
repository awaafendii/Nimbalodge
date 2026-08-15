import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { ActivitiesService } from "./activities.service";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";

@Controller("activities")
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @RequirePermissions("activities.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.activitiesService.list(user);
  }

  @Get(":id")
  @RequirePermissions("activities.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.activitiesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("activities.create")
  create(@Body() dto: CreateActivityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.activitiesService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("activities.update")
  update(@Param("id") id: string, @Body() dto: UpdateActivityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.activitiesService.update(id, dto, user);
  }
}
