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
  // Permission représentative du module — absente si l'entrée doit toujours rester visible
  // (Tableau de bord). Filtrée dans Sidebar via useAuthStore(s => s.hasPermission).
  permission?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "Tableau de bord", subtitle: "Vue d'ensemble", icon: Icons.IconDashboard },
      { to: "/finance", label: "Finance", subtitle: "Budgets, recettes, dépenses, caisse, banque", icon: Icons.IconWallet, permission: "finance.summary.view" },
      { to: "/reservations", label: "Réservations", subtitle: "Demandes, séjours, check-in / check-out", icon: Icons.IconInvoice, permission: "reservations.view" },
      { to: "/rooms", label: "Chambres", subtitle: "Types de chambres, tarifs, statuts", icon: Icons.IconBed, permission: "rooms.view" },
      { to: "/guests", label: "Clients", subtitle: "Identité, historique, préférences", icon: Icons.IconUsers, permission: "guests.view" },
    ],
  },
  {
    label: "RH & Paie",
    items: [
      { to: "/hr", label: "RH", subtitle: "Employés, contrats, présence, congés", icon: Icons.IconBuilding, permission: "employees.view" },
      { to: "/payroll", label: "Paie", subtitle: "Salaires, primes, retenues", icon: Icons.IconWallet, permission: "payslips.view" },
    ],
  },
  {
    label: "Achats & Stock",
    items: [
      { to: "/purchases", label: "Achats", subtitle: "Demandes, commandes, fournisseurs", icon: Icons.IconInvoice, permission: "purchase-orders.view" },
      { to: "/inventory", label: "Stock", subtitle: "Produits, entrepôts, mouvements", icon: Icons.IconReport, permission: "products.view" },
      { to: "/housekeeping", label: "Housekeeping", subtitle: "Statut des chambres, nettoyage", icon: Icons.IconLeaf, permission: "housekeeping-tasks.view" },
      { to: "/maintenance", label: "Maintenance", subtitle: "Équipements, interventions", icon: Icons.IconWarn, permission: "maintenance-interventions.view" },
    ],
  },
  {
    label: "Système",
    items: [
      { to: "/reports", label: "Rapports", subtitle: "Rapports paramétrables, export", icon: Icons.IconReport, permission: "reports.financial.view" },
      { to: "/notifications", label: "Notifications", subtitle: "Alertes, échéances, audit", icon: Icons.IconBell, permission: "notifications.view" },
      { to: "/settings", label: "Paramètres", subtitle: "Organisation, hôtel, départements", icon: Icons.IconGear, permission: "departments.view" },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
