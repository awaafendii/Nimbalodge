import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PermissionsService } from "../../modules/permissions/permissions.service";
import { SKIP_PERMISSION_CHECK_KEY } from "../decorators/authenticated-only.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../types/authenticated-request";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && required.length > 0) {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const { permissions } = await this.permissionsService.resolveForUser(request.user.id, request.user.hotelId);
      const hasAll = required.every((key) => permissions.has(key));
      if (!hasAll) {
        throw new ForbiddenException("Permissions insuffisantes");
      }
      return true;
    }

    // Fail-closed : une route ni @Public() ni couverte par @RequirePermissions() doit déclarer
    // explicitement @AuthenticatedOnly() pour rester accessible — sinon un handler oublié ne
    // devient jamais silencieusement accessible à tout utilisateur authentifié (Étape 7).
    const skipPermissionCheck = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSION_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipPermissionCheck) return true;

    throw new ForbiddenException("Permissions insuffisantes");
  }
}
