import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Req } from "@nestjs/common";
import type { Request } from "express";

import { AuthenticatedOnly } from "../../common/decorators/authenticated-only.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { SessionsService } from "./sessions.service";

// Gestion de ses PROPRES sessions -- @AuthenticatedOnly() partout, aucune permission RBAC
// spécifique (même raisonnement que GET /auth/me et le module 2FA).
@Controller("auth/sessions")
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @AuthenticatedOnly()
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.list(user.id);
  }

  @AuthenticatedOnly()
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Req() request: Request) {
    return this.sessionsService.revoke(user.id, id, request.ip ?? null);
  }

  @AuthenticatedOnly()
  @Delete()
  @HttpCode(HttpStatus.OK)
  revokeAll(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.sessionsService.revokeAll(user.id, request.ip ?? null);
  }
}
