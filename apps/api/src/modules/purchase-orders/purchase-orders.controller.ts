import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { GoodsReceiptsService } from "./goods-receipts.service";
import { PurchaseOrdersService } from "./purchase-orders.service";

@Controller("purchase-orders")
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly goodsReceiptsService: GoodsReceiptsService
  ) {}

  @Get()
  @RequirePermissions("purchase-orders.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.list(user);
  }

  @Get(":id")
  @RequirePermissions("purchase-orders.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("purchase-orders.create")
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("purchase-orders.update")
  update(@Param("id") id: string, @Body() dto: UpdatePurchaseOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.update(id, dto, user);
  }

  @Post(":id/send")
  @RequirePermissions("purchase-orders.send")
  send(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.send(id, user);
  }

  @Post(":id/cancel")
  @RequirePermissions("purchase-orders.cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.cancel(id, user);
  }

  @Get(":id/receipts")
  @RequirePermissions("goods-receipts.view")
  listReceipts(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.goodsReceiptsService.list(id, user);
  }

  @Post(":id/receipts")
  @RequirePermissions("goods-receipts.create")
  createReceipt(@Param("id") id: string, @Body() dto: CreateGoodsReceiptDto, @CurrentUser() user: AuthenticatedUser) {
    return this.goodsReceiptsService.create(id, dto, user);
  }
}
