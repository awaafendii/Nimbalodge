import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import { LeaveRequestsService } from "./leave-requests.service";

@Controller("leave-requests")
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @RequirePermissions("leave-requests.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("leave-requests.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("leave-requests.create")
  create(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("leave-requests.update")
  update(@Param("id") id: string, @Body() dto: UpdateLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestsService.update(id, dto, user);
  }

  @Post(":id/approve")
  @RequirePermissions("leave-requests.approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestsService.approve(id, user);
  }

  @Post(":id/reject")
  @RequirePermissions("leave-requests.reject")
  reject(@Param("id") id: string, @Body() dto: RejectLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestsService.reject(id, dto, user);
  }

  @Post(":id/cancel")
  @RequirePermissions("leave-requests.cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestsService.cancel(id, user);
  }
}
