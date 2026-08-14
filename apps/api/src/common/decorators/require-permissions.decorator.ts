import { SetMetadata } from "@nestjs/common";

// Clé au format "domaine.ressource.action" (ex. "users.view", "finance.expense.create") — §30.
export const PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
