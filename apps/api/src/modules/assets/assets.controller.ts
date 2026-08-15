import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { AssetsService } from "./assets.service";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequirePermissions("assets.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.list(user);
  }

  @Get(":id")
  @RequirePermissions("assets.view")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions("assets.create")
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("assets.update")
  update(@Param("id") id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.update(id, dto, user);
  }
}
