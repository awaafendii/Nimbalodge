import { SetMetadata } from "@nestjs/common";

// Marque explicitement une route comme n'exigeant qu'une authentification valide, sans permission
// RBAC spécifique (ex. GET /auth/me — un utilisateur consulte toujours son propre profil). Distinct
// de @Public() (qui exempte aussi JwtAuthGuard) : ici JwtAuthGuard s'applique toujours, seul
// PermissionsGuard est court-circuité, et de façon déclarée plutôt qu'implicite — voir
// permissions.guard.ts, qui refuse désormais par défaut (403) toute route sans @RequirePermissions()
// NI ce marqueur, pour qu'un handler oublié ne devienne jamais silencieusement accessible à tout
// utilisateur authentifié (Étape 7, durcissement RBAC).
export const SKIP_PERMISSION_CHECK_KEY = "skipPermissionCheck";
export const AuthenticatedOnly = () => SetMetadata(SKIP_PERMISSION_CHECK_KEY, true);
