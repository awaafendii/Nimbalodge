import { Icons } from "@nimbalodge/ui";
import type { ComponentType, SVGProps } from "react";

// Source unique de vérité pour la nav — consommée par Sidebar (rendu), Topbar (titre/sous-titre)
// et router.tsx (génération des routes). Remplace la nav immobilière figée de
// nimbalodge-app/src/components/layout/Sidebar.jsx par les 14 modules cibles (brief §43).

export interface NavItem {
  to: string;
  label: string;
  subtitle: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "Tableau de bord", subtitle: "Vue d'ensemble — démonstration du design system", icon: Icons.IconDashboard },
      { to: "/finance", label: "Finance", subtitle: "Budgets, recettes, dépenses, caisse, banque", icon: Icons.IconWallet },
      { to: "/reservations", label: "Réservations", subtitle: "Demandes, séjours, check-in / check-out", icon: Icons.IconInvoice },
      { to: "/rooms", label: "Chambres", subtitle: "Types de chambres, tarifs, statuts", icon: Icons.IconBed },
      { to: "/guests", label: "Clients", subtitle: "Identité, historique, préférences", icon: Icons.IconUsers },
    ],
  },
  {
    label: "RH & Paie",
    items: [
      { to: "/hr", label: "RH", subtitle: "Employés, contrats, présence, congés", icon: Icons.IconBuilding },
      { to: "/payroll", label: "Paie", subtitle: "Salaires, primes, retenues", icon: Icons.IconWallet },
    ],
  },
  {
    label: "Achats & Stock",
    items: [
      { to: "/purchases", label: "Achats", subtitle: "Demandes, commandes, fournisseurs", icon: Icons.IconInvoice },
      { to: "/inventory", label: "Stock", subtitle: "Produits, entrepôts, mouvements", icon: Icons.IconReport },
      { to: "/housekeeping", label: "Housekeeping", subtitle: "Statut des chambres, nettoyage", icon: Icons.IconLeaf },
      { to: "/maintenance", label: "Maintenance", subtitle: "Équipements, interventions", icon: Icons.IconWarn },
    ],
  },
  {
    label: "Système",
    items: [
      { to: "/reports", label: "Rapports", subtitle: "Rapports paramétrables, export", icon: Icons.IconReport },
      { to: "/notifications", label: "Notifications", subtitle: "Alertes, échéances, audit", icon: Icons.IconBell },
      { to: "/settings", label: "Paramètres", subtitle: "Organisation, hôtel, départements", icon: Icons.IconGear },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
