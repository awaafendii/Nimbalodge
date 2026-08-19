import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";

import { Public } from "../../common/decorators/public.decorator";
import { ConfirmPasswordResetDto } from "./dto/confirm-password-reset.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { PasswordResetService } from "./password-reset.service";

// @Public() sur les deux : un utilisateur qui a oublié son mot de passe n'a par définition pas de
// session valide. Throttle plus strict sur "request" (3/60s) qu'ailleurs dans le module auth
// (5/60s) : c'est l'endpoint le plus directement exposé à une énumération d'emails par essai-erreur.
@Controller("auth/password-reset")
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("request")
  @HttpCode(HttpStatus.OK)
  request(@Body() dto: RequestPasswordResetDto, @Req() request: Request) {
    return this.passwordResetService.requestReset(dto.email, request.ip ?? null);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  confirm(@Body() dto: ConfirmPasswordResetDto, @Req() request: Request) {
    return this.passwordResetService.confirmReset(dto.token, dto.newPassword, request.ip ?? null);
  }
}
