import type { Request } from "express";

// Reflète le payload minimal du JWT d'accès (voir jwt-access.strategy.ts) — pas de permissions
// embarquées, résolues à chaque requête par PermissionsGuard via PermissionsService.
export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  hotelId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
