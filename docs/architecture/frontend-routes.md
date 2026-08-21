# Routes frontend vérifiées — visibilité en nav par profil

> Extrait de `apps/web/src/app/router.tsx` (routes réelles) et `apps/web/src/components/layout/
> nav-config.tsx` (permission qui contrôle la visibilité dans la Sidebar pour chaque entrée).
> Aucune route n'est inventée. `RequireAuth` ne vérifie que l'authentification (token valide),
> jamais la permission — toute route ci-dessous est directement navigable par n'importe quel
> utilisateur connecté ; ce que la permission contrôle, c'est (a) la visibilité dans la Sidebar et
> (b) les données réellement renvoyées par les endpoints que la page interroge (403 backend sinon).
> Voir `docs/architecture/rbac-multi-hotel.md` pour le constat détaillé.

## Tableau de bord

| Route | Permission nav | Visible pour |
|---|---|---|
| `/dashboard` | — toujours visible | tous les profils authentifiés |

## Finance

| Route | Permission nav | Visible pour |
|---|---|---|
| `/finance` | — vue d'ensemble | tous les profils authentifiés |
| `/finance/revenues` | `finance-revenues.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER |
| `/finance/expenses` | `finance-expenses.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER |
| `/finance/cash` | `finance-cash-accounts.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER |
| `/finance/bank` | `finance-bank-accounts.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER |
| `/finance/budgets` | `finance-budgets.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER |
| `/finance/invoices` | `finance-invoices.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER, RECEPTIONNISTE |

## Hébergement

| Route | Permission nav | Visible pour |
|---|---|---|
| `/hebergement` | — vue d'ensemble | tous les profils authentifiés |
| `/hebergement/reservations` | `reservations.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RECEPTIONNISTE |
| `/hebergement/rooms` | `rooms.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RECEPTIONNISTE, HOUSEKEEPING |
| `/hebergement/guests` | `guests.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RECEPTIONNISTE |

## RH & Paie

| Route | Permission nav | Visible pour |
|---|---|---|
| `/hr` | — vue d'ensemble | tous les profils authentifiés |
| `/hr/employees` | `employees.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_RH |
| `/hr/leave` | `leave-requests.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_RH |
| `/hr/attendance` | `attendance.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_RH |
| `/hr/payroll` | `payslips.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_RH |

## Achats & Stock

| Route | Permission nav | Visible pour |
|---|---|---|
| `/purchases` | `purchase-orders.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_STOCK |
| `/stocks` | — vue d'ensemble | tous les profils authentifiés |
| `/stocks/products` | `products.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_STOCK, RESPONSABLE_MAINTENANCE |
| `/stocks/movements` | `stock-movements.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_STOCK, RESPONSABLE_MAINTENANCE |
| `/stocks/warehouses` | `warehouses.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_STOCK |
| `/housekeeping` | `housekeeping-tasks.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, HOUSEKEEPING |
| `/maintenance` | `maintenance-interventions.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_MAINTENANCE |

## Système

| Route | Permission nav | Visible pour |
|---|---|---|
| `/reports` | `reports.financial.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER |
| `/notifications` | `notifications.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER, RESPONSABLE_RH, RECEPTIONNISTE, RESPONSABLE_STOCK, RESPONSABLE_MAINTENANCE, HOUSEKEEPING |
| `/audit-logs` | `audit-logs.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL |
| `/nimba-ai` | `nimba-ai.use` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER, RESPONSABLE_RH |
| `/settings` | `departments.view` | SUPER_ADMIN, BOSS, DIRECTEUR_HOTEL, RESPONSABLE_FINANCIER, RESPONSABLE_RH |

