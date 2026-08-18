import { SetMetadata } from "@nestjs/common";

// Clé au format "resource.action" (ex. "users.view", "finance-expenses.create") — §30.
export const PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
