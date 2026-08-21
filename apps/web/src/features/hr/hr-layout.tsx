import { Outlet } from "react-router-dom";

// Coquille du module RH (architecture module → sous-module, même pattern que Finance —
// finance-layout.tsx). Navigation entre sous-modules via la Sidebar uniquement (arbre repliable
// RH → 4 sous-modules), pas de bandeau d'onglets redondant. Simple point d'ancrage pour les routes
// enfants (router.tsx).
export default function HrLayout() {
  return <Outlet />;
}
