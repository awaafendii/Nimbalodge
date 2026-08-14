import { Controller, Get } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { RolesService } from "./roles.service";

@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions("roles.view")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.listForOrganization(user.organizationId);
  }
}
