import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [StockMovementsModule, NotificationsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
