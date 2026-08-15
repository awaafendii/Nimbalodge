import { Body, Controller, Get, Post, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { ListStockMovementsQueryDto } from "./dto/list-stock-movements-query.dto";
import { StockMovementsService } from "./stock-movements.service";

@Controller("stock-movements")
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Get()
  @RequirePermissions("stock-movements.view")
  list(@Query() query: ListStockMovementsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stockMovementsService.list(query, user);
  }

  // IN/OUT/CONSUMPTION/LOSS — type dans le corps de la requête.
  @Post()
  @RequirePermissions("stock-movements.create")
  create(@Body() dto: CreateStockMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stockMovementsService.create(dto, user);
  }

  @Post("transfer")
  @RequirePermissions("stock-movements.transfer")
  createTransfer(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stockMovementsService.createTransfer(dto, user);
  }

  @Post("adjustment")
  @RequirePermissions("stock-movements.adjustment")
  createAdjustment(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stockMovementsService.createAdjustment(dto, user);
  }
}
