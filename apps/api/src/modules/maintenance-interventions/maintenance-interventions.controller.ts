import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateMaintenanceInterventionDto } from "./dto/create-maintenance-intervention.dto";
import { ListMaintenanceInterventionsQueryDto } from "./dto/list-maintenance-interventions-query.dto";
import { UpdateMaintenanceInterventionDto } from "./dto/update-maintenance-intervention.dto";
import { MaintenanceInterventionsService } from "./maintenance-interventions.service";

@Controller("maintenance-interventions")
export class MaintenanceInterventionsController {
  constructor(private readonly maintenanceInterventionsService: MaintenanceInterventionsService) {}

  @Get()
  @RequirePermissions("maintenance-interventions.view")
  list(@Query() query: ListMaintenanceInterventionsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceInterventionsService.list(query, user);
  }

  @Get(":id")
  @RequirePermissions("maintenance-interventions.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceInterventionsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("maintenance-interventions.create")
  create(@Body() dto: CreateMaintenanceInterventionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceInterventionsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("maintenance-interventions.update")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateMaintenanceInterventionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.maintenanceInterventionsService.update(id, dto, user);
  }

  @Post(":id/start")
  @RequirePermissions("maintenance-interventions.start")
  start(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceInterventionsService.start(id, user);
  }

  @Post(":id/complete")
  @RequirePermissions("maintenance-interventions.complete")
  complete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceInterventionsService.complete(id, user);
  }

  @Post(":id/cancel")
  @RequirePermissions("maintenance-interventions.cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceInterventionsService.cancel(id, user);
  }
}
