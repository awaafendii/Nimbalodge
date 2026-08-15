import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullScreenLoader } from "../common/full-screen-loader.js";
import { useMe } from "../../hooks/use-auth.js";
import { useAuthStore } from "../../stores/auth-store.js";

// Garde de route réelle (RBAC backend, Phase 3) — remplace l'absence de garde de la Phase 1.
// GET /auth/me revalide le token à chaque montage (staleTime 5 min) : un token présent en storage
// mais révoqué/expiré redirige vers /login au lieu d'afficher un shell vide.
export function RequireAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const { isLoading, isError } = useMe();

  if (!accessToken || isError) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!user && isLoading) {
    return <FullScreenLoader />;
  }
  return <Outlet />;
}
