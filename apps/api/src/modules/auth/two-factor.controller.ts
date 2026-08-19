import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";

import { AuthenticatedOnly } from "../../common/decorators/authenticated-only.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { DisableTwoFactorDto } from "./dto/disable-two-factor.dto";
import { EnableTwoFactorDto } from "./dto/enable-two-factor.dto";
import { VerifyTwoFactorDto } from "./dto/verify-two-factor.dto";
import { TwoFactorService } from "./two-factor.service";

// setup/enable/disable : @AuthenticatedOnly() -- gestion de son PROPRE 2FA, aucune permission RBAC
// spécifique (même raisonnement que GET /auth/me). verify : @Public(), le client n'a encore qu'un
// challengeToken à ce stade, pas de session -- throttlé comme login (code à 6 chiffres, sensible au
// brute-force).
@Controller("auth/2fa")
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @AuthenticatedOnly()
  @Post("setup")
  @HttpCode(HttpStatus.OK)
  setup(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.setup(user.id);
  }

  @AuthenticatedOnly()
  @Post("enable")
  @HttpCode(HttpStatus.OK)
  enable(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnableTwoFactorDto, @Req() request: Request) {
    return this.twoFactorService.enable(user.id, dto.code, request.ip ?? null);
  }

  @AuthenticatedOnly()
  @Post("disable")
  @HttpCode(HttpStatus.OK)
  disable(@CurrentUser() user: AuthenticatedUser, @Body() dto: DisableTwoFactorDto, @Req() request: Request) {
    return this.twoFactorService.disable(user.id, dto.password, request.ip ?? null);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("verify")
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyTwoFactorDto, @Req() request: Request) {
    return this.twoFactorService.verifyChallenge(dto.challengeToken, dto.code, request.ip ?? null);
  }
}
