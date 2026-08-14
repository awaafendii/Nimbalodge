import { Controller, Get } from "@nestjs/common";

import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PermissionsService } from "./permissions.service";

@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions("permissions.view")
  list() {
    return this.permissionsService.list();
  }
}
