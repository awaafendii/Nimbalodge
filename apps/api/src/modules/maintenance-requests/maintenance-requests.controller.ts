import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import { RejectMaintenanceRequestDto } from "./dto/reject-maintenance-request.dto";
import { UpdateMaintenanceRequestDto } from "./dto/update-maintenance-request.dto";
import { MaintenanceRequestsService } from "./maintenance-requests.service";

@Controller("maintenance-requests")
export class MaintenanceRequestsController {
  constructor(private readonly maintenanceRequestsService: MaintenanceRequestsService) {}

  @Get()
  @RequirePermissions("maintenance-requests.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceRequestsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("maintenance-requests.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceRequestsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("maintenance-requests.create")
  create(@Body() dto: CreateMaintenanceRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceRequestsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("maintenance-requests.update")
  update(@Param("id") id: string, @Body() dto: UpdateMaintenanceRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceRequestsService.update(id, dto, user);
  }

  @Post(":id/approve")
  @RequirePermissions("maintenance-requests.approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceRequestsService.approve(id, user);
  }

  @Post(":id/reject")
  @RequirePermissions("maintenance-requests.reject")
  reject(@Param("id") id: string, @Body() dto: RejectMaintenanceRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceRequestsService.reject(id, dto, user);
  }

  @Post(":id/cancel")
  @RequirePermissions("maintenance-requests.cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceRequestsService.cancel(id, user);
  }
}
