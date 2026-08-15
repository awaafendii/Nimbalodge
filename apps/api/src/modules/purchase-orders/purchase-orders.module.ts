import { Module } from "@nestjs/common";

import { GoodsReceiptsService } from "./goods-receipts.service";
import { PurchaseOrdersController } from "./purchase-orders.controller";
import { PurchaseOrdersService } from "./purchase-orders.service";

@Module({
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, GoodsReceiptsService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
