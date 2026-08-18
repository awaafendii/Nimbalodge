import { useAuthStore } from "../stores/auth-store.js";

// Étape 7 (RBAC) — filtrage des actions sensibles au niveau bouton, pas seulement au niveau nav
// (Sidebar). Toujours backé par la liste de permissions résolue par le backend (auth-store.
// hasPermission) — jamais une règle client-side indépendante. Le backend reste la seule autorité :
// masquer un bouton ici est de l'ergonomie (éviter un 403 après coup), pas la garantie de sécurité.
export function usePermission(key: string): boolean {
  return useAuthStore((s) => s.hasPermission(key));
}
