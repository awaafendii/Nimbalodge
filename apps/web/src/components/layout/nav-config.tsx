import { Icons } from "@nimbalodge/ui";
import type { ComponentType, SVGProps } from "react";

// Source unique de vérité pour la nav — consommée par Sidebar (rendu), Topbar (titre/sous-titre)
// et router.tsx (génération des routes). Remplace la nav immobilière figée de
// docs/legacy/nimbalodge-app/src/components/layout/Sidebar.jsx par les 14 modules cibles (brief §43).

// Sous-module de navigation (architecture module → sous-module, ex. Finance → Recettes/Dépenses/
// .../Facturation) — pas d'icône propre, affiché en retrait sous son module parent.
export interface NavSubItem {
  to: string;
  label: string;
  subtitle: string;
  permission?: string;
}

export interface NavItem {
  to: string;
  label: string;
  subtitle: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // Permission représentative du module — absente si l'entrée doit toujours rester visible
  // (Tableau de bord). Filtrée dans Sidebar via useAuthStore(s => s.hasPermission). Pour un module
  // avec `children`, cette permission (si présente) s'ajoute au filtre "au moins un enfant
  // visible" — un parent sans `permission` propre reste visible dès qu'un enfant l'est.
  permission?: string;
  // Sous-modules (ex. Finance, RH) : chacun a son propre écran + sa propre permission. Le parent
  // n'est affiché dans la Sidebar que si au moins un enfant est visible pour l'utilisateur courant.
  children?: NavSubItem[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Sous-modules Finance — source unique de vérité, consommée par Sidebar (arbre replié), le
// bandeau d'onglets de FinanceLayout et le router (une route enfant par entrée). Permissions déjà
// existantes dans le catalogue (prisma/permissions-catalog.ts), aucune n'a été créée pour ce
// découpage.
export const FINANCE_SUB_ITEMS: NavSubItem[] = [
  { to: "/finance/revenues", label: "Recettes", subtitle: "Recettes du jour, du mois, par département", permission: "finance-revenues.view" },
  { to: "/finance/expenses", label: "Dépenses", subtitle: "Dépenses et workflow d'approbation", permission: "finance-expenses.view" },
  { to: "/finance/cash", label: "Caisse", subtitle: "Comptes caisse et transactions", permission: "finance-cash-accounts.view" },
  { to: "/finance/bank", label: "Banque", subtitle: "Comptes bancaires et opérations", permission: "finance-bank-accounts.view" },
  { to: "/finance/budgets", label: "Budget", subtitle: "Budgets, exécution, dépassements", permission: "finance-budgets.view" },
  { to: "/finance/invoices", label: "Facturation", subtitle: "Factures, paiements, avoirs", permission: "finance-invoices.view" },
];

// Sous-modules RH — même principe que FINANCE_SUB_ITEMS. Paie n'est plus un module racine séparé
// (ex-/payroll) : elle rejoint RH comme sous-module, conformément à l'architecture module →
// sous-module demandée.
export const HR_SUB_ITEMS: NavSubItem[] = [
  { to: "/hr/employees", label: "Employés", subtitle: "Effectif, contrats, répartition par département", permission: "employees.view" },
  { to: "/hr/leave", label: "Congés", subtitle: "Demandes, approbations, absences en cours", permission: "leave-requests.view" },
  { to: "/hr/attendance", label: "Présence", subtitle: "Pointage, présents/absents, taux de présence", permission: "attendance.view" },
  { to: "/hr/payroll", label: "Paie", subtitle: "Bulletins, masse salariale, paiements", permission: "payslips.view" },
];

// Sous-modules Hébergement (Réservations + Chambres + Clients — 3 modules racine fusionnés en un
// seul parent) et Stocks (Articles/Mouvements/Entrepôts — ex-écran /inventory unique). Même
// principe que FINANCE_SUB_ITEMS/HR_SUB_ITEMS.
export const HEBERGEMENT_SUB_ITEMS: NavSubItem[] = [
  { to: "/hebergement/reservations", label: "Réservations", subtitle: "Demandes, séjours, check-in / check-out", permission: "reservations.view" },
  { to: "/hebergement/rooms", label: "Chambres", subtitle: "Types de chambres, tarifs, statuts", permission: "rooms.view" },
  { to: "/hebergement/guests", label: "Clients", subtitle: "Identité, historique, préférences", permission: "guests.view" },
];

export const STOCKS_SUB_ITEMS: NavSubItem[] = [
  { to: "/stocks/products", label: "Articles", subtitle: "Catalogue, seuils, stock faible", permission: "products.view" },
  { to: "/stocks/movements", label: "Mouvements", subtitle: "Entrées, sorties, transferts, ajustements", permission: "stock-movements.view" },
  { to: "/stocks/warehouses", label: "Entrepôts", subtitle: "Entrepôts et répartition des mouvements", permission: "warehouses.view" },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "Tableau de bord", subtitle: "Vue d'ensemble", icon: Icons.IconDashboard },
      { to: "/finance", label: "Finance", subtitle: "Budgets, recettes, dépenses, caisse, banque", icon: Icons.IconWallet, children: FINANCE_SUB_ITEMS },
      { to: "/hebergement", label: "Hébergement", subtitle: "Réservations, chambres, clients", icon: Icons.IconBed, children: HEBERGEMENT_SUB_ITEMS },
    ],
  },
  {
    label: "RH & Paie",
    items: [
      { to: "/hr", label: "RH", subtitle: "Employés, congés, présence, paie", icon: Icons.IconBuilding, children: HR_SUB_ITEMS },
    ],
  },
  {
    label: "Achats & Stock",
    items: [
      { to: "/purchases", label: "Achats", subtitle: "Demandes, commandes, fournisseurs", icon: Icons.IconInvoice, permission: "purchase-orders.view" },
      { to: "/stocks", label: "Stocks", subtitle: "Articles, mouvements, entrepôts", icon: Icons.IconReport, children: STOCKS_SUB_ITEMS },
      { to: "/housekeeping", label: "Housekeeping", subtitle: "Statut des chambres, nettoyage", icon: Icons.IconLeaf, permission: "housekeeping-tasks.view" },
      { to: "/maintenance", label: "Maintenance", subtitle: "Équipements, interventions", icon: Icons.IconWarn, permission: "maintenance-interventions.view" },
    ],
  },
  {
    label: "Système",
    items: [
      { to: "/reports", label: "Rapports", subtitle: "Rapports paramétrables, export", icon: Icons.IconReport, permission: "reports.financial.view" },
      { to: "/notifications", label: "Notifications", subtitle: "Alertes, échéances", icon: Icons.IconBell, permission: "notifications.view" },
      { to: "/audit-logs", label: "Audit", subtitle: "Journal des actions, avant/après", icon: Icons.IconShield, permission: "audit-logs.view" },
      { to: "/nimba-ai", label: "Nimba AI", subtitle: "Insights, anomalies, assistant", icon: Icons.IconSparkles, permission: "nimba-ai.use" },
      { to: "/settings", label: "Paramètres", subtitle: "Organisation, hôtel, départements", icon: Icons.IconGear, permission: "departments.view" },
    ],
  },
];

// Aplatit parents ET enfants (icône du parent réutilisée pour ses enfants, seulement utile là où
// Topbar/RequireAuth ont besoin d'un titre/sous-titre par route exacte — Sidebar lit NAV_GROUPS
// directement pour préserver la hiérarchie visuelle).
export const ALL_NAV_ITEMS: (NavItem | (NavSubItem & { icon: NavItem["icon"] }))[] = NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((item) => [item, ...(item.children ?? []).map((child) => ({ ...child, icon: item.icon }))])
);
