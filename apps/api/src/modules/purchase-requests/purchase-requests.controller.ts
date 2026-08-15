import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreatePurchaseRequestDto } from "./dto/create-purchase-request.dto";
import { RejectPurchaseRequestDto } from "./dto/reject-purchase-request.dto";
import { UpdatePurchaseRequestDto } from "./dto/update-purchase-request.dto";
import { PurchaseRequestsService } from "./purchase-requests.service";

@Controller("purchase-requests")
export class PurchaseRequestsController {
  constructor(private readonly purchaseRequestsService: PurchaseRequestsService) {}

  @Get()
  @RequirePermissions("purchase-requests.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.purchaseRequestsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("purchase-requests.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseRequestsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("purchase-requests.create")
  create(@Body() dto: CreatePurchaseRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseRequestsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("purchase-requests.update")
  update(@Param("id") id: string, @Body() dto: UpdatePurchaseRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseRequestsService.update(id, dto, user);
  }

  @Post(":id/approve")
  @RequirePermissions("purchase-requests.approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseRequestsService.approve(id, user);
  }

  @Post(":id/reject")
  @RequirePermissions("purchase-requests.reject")
  reject(@Param("id") id: string, @Body() dto: RejectPurchaseRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseRequestsService.reject(id, dto, user);
  }

  @Post(":id/cancel")
  @RequirePermissions("purchase-requests.cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseRequestsService.cancel(id, user);
  }
}
