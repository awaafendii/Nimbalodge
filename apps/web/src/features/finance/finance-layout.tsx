import { Outlet } from "react-router-dom";

// Coquille du module Finance (architecture module → sous-module, §1). Le bandeau d'onglets
// horizontal a été retiré : redondant avec la Sidebar (arbre repliable Finance → 6 sous-modules,
// voir components/layout/Sidebar.tsx), qui suffit seule pour naviguer entre sous-modules — y
// compris sur mobile via le menu hamburger. Reste un simple point d'ancrage pour les routes
// enfants (router.tsx) — libre pour un futur habillage propre au module si besoin.
export default function FinanceLayout() {
  return <Outlet />;
}
