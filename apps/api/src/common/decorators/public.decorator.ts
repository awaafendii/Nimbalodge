import { SetMetadata } from "@nestjs/common";

// Exempte une route des guards globaux (JwtAuthGuard + PermissionsGuard) — utilisé pour
// login/refresh/logout (impossible d'exiger un token pour obtenir un token) et pour /health
// (contrat Phase 2 : healthcheck Docker/monitoring, doit rester accessible sans auth).
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
