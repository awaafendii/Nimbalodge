import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions("products.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.list(user);
  }

  @Post("check-low-stock")
  @RequirePermissions("products.check-low-stock")
  checkLowStock(@CurrentUser() user: AuthenticatedUser) {
    return this.productsService.checkLowStock(user);
  }

  @Get(":id")
  @RequirePermissions("products.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.findOne(id, user);
  }

  @Get(":id/stock")
  @RequirePermissions("products.view")
  getStock(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.getStock(id, user);
  }

  @Post()
  @RequirePermissions("products.create")
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("products.update")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.update(id, dto, user);
  }
}
