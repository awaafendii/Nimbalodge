import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";

import { AuthenticatedOnly } from "../../common/decorators/authenticated-only.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

// login/refresh doivent être @Public() : impossible d'exiger un token d'accès pour en obtenir un
// (deadlock). logout est @Public() pour une raison différente : il doit rester utilisable même
// après expiration de l'access token (l'utilisateur clique "se déconnecter" avec une session déjà
// expirée) — mais reste authentifié par un credential fort, le refresh token brut lui-même, vérifié
// cryptographiquement dans AuthService.logout() avant toute révocation (voir ce fichier). Throttle
// sur les trois (Étape 7) : login/refresh restent les plus exposés au brute-force (§52), logout
// vérifie une signature JWT à chaque appel donc coûte peu mais ne doit pas rester sans limite pour
// autant.
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto.email, dto.password, {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refreshTokens(dto.refreshToken, {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.logout(dto.refreshToken, request.ip ?? null);
  }

  @AuthenticatedOnly()
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.resolveMe(user.id);
  }
}
