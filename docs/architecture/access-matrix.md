# Matrice d'accès RBAC — 9 profils métier

> Générée programmatiquement depuis `prisma/permissions-catalog.ts` (138 permissions, vérifié via
> `grep -c '{ key:' prisma/permissions-catalog.ts`) et `prisma/seed.ts` (ensembles de permissions
> exacts par rôle). Aucune ligne n'est transcrite à la main — voir
> `docs/architecture/rbac-multi-hotel.md` pour la version interactive (filtrable) et le contexte
> de décision. En cas de divergence future, le code (`permissions-catalog.ts`/`seed.ts`) fait foi.

Colonnes : **SA**=SUPER_ADMIN, **BO**=BOSS, **DH**=DIRECTEUR_HOTEL, **RF**=RESPONSABLE_FINANCIER,
**RH**=RESPONSABLE_RH, **RE**=RECEPTIONNISTE, **RS**=RESPONSABLE_STOCK,
**RM**=RESPONSABLE_MAINTENANCE, **HK**=HOUSEKEEPING. ✅ = permission accordée, — = non accordée.
Aucune clé `.delete` n'existe dans le catalogue actuel (pas de suppression au niveau permission,
dans aucun module) — colonne Delete absente par construction.

## Effectif par rôle

| Rôle | Nature | Permissions | Nimba AI |
|---|---|---:|:---:|
| SUPER_ADMIN | Plateforme | 138 / 138 | ✅ |
| BOSS | Métier | 137 / 138 | ✅ |
| DIRECTEUR_HOTEL | Métier | 132 / 138 | ✅ |
| RESPONSABLE_FINANCIER | Métier | 44 / 138 | ✅ |
| RESPONSABLE_RH | Métier | 26 / 138 | ✅ |
| RECEPTIONNISTE | Métier | 20 / 138 | — |
| RESPONSABLE_STOCK | Métier | 31 / 138 | — |
| RESPONSABLE_MAINTENANCE | Métier | 21 / 138 | — |
| HOUSEKEEPING | Métier | 9 / 138 | — |

## Détail par module

### Administration

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Utilisateurs | — | `users.view` | View | Voir les utilisateurs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Utilisateurs | — | `users.create` | Create | Créer un utilisateur | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Rôles | — | `roles.view` | View | Voir les rôles | ✅ | ✅ | — | — | — | — | — | — | — |
| Permissions | — | `permissions.view` | View | Voir les permissions | ✅ | ✅ | — | — | — | — | — | — | — |
| Organisation | `/settings` | `organizations.view` | View | Voir l'organisation | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Hôtels (portefeuille) | `/settings` | `hotels.view` | View | Voir les hôtels | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hôtels (portefeuille) | `/settings` | `hotels.create` | Create | Créer un hôtel | ✅ | ✅ | — | — | — | — | — | — | — |
| Hôtels (portefeuille) | `/settings` | `hotels.update` | Update | Modifier un hôtel | ✅ | ✅ | — | — | — | — | — | — | — |
| Départements | `/settings` | `departments.view` | View | Voir les départements | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| Départements | `/settings` | `departments.create` | Create | Créer un département | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Départements | `/settings` | `departments.update` | Update | Modifier un département | ✅ | ✅ | ✅ | — | — | — | — | — | — |

### Finance

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Activités (référentiel) | — | `activities.view` | View | Voir les activités | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Activités (référentiel) | — | `activities.create` | Create | Créer une activité | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Activités (référentiel) | — | `activities.update` | Update | Modifier une activité | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Centres de coûts | — | `cost-centers.view` | View | Voir les centres de coûts | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Centres de coûts | — | `cost-centers.create` | Create | Créer un centre de coûts | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Centres de coûts | — | `cost-centers.update` | Update | Modifier un centre de coûts | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Catégories financières | — | `finance-categories.view` | View | Voir les catégories financières | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Catégories financières | — | `finance-categories.create` | Create | Créer une catégorie financière | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Catégories financières | — | `finance-categories.update` | Update | Modifier une catégorie financière | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Caisse | `/finance/cash` | `finance-cash-accounts.view` | View | Voir les caisses | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Caisse | `/finance/cash` | `finance-cash-accounts.create` | Create | Créer une caisse | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Caisse | `/finance/cash` | `finance-cash-accounts.update` | Update | Modifier une caisse / saisir une opération | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Banque | `/finance/bank` | `finance-bank-accounts.view` | View | Voir les comptes bancaires | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Banque | `/finance/bank` | `finance-bank-accounts.create` | Create | Créer un compte bancaire | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Banque | `/finance/bank` | `finance-bank-accounts.update` | Update | Modifier un compte bancaire / saisir une opération | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Recettes | `/finance/revenues` | `finance-revenues.view` | View | Voir les recettes | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Recettes | `/finance/revenues` | `finance-revenues.create` | Create | Créer une recette | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Dépenses | `/finance/expenses` | `finance-expenses.view` | View | Voir les dépenses | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Dépenses | `/finance/expenses` | `finance-expenses.create` | Create | Créer une dépense | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Dépenses | `/finance/expenses` | `finance-expenses.update` | Update | Modifier une dépense en brouillon | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Dépenses | `/finance/expenses` | `finance-expenses.submit` | Autre (submit) | Soumettre une dépense | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Dépenses | `/finance/expenses` | `finance-expenses.approve` | Approve | Approuver ou rejeter une dépense | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Dépenses | `/finance/expenses` | `finance-expenses.pay` | Pay | Marquer une dépense comme payée | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Dépenses | `/finance/expenses` | `finance-expenses.book` | Book | Comptabiliser une dépense | ✅ | ✅ | — | — | — | — | — | — | — |
| Budget | `/finance/budgets` | `finance-budgets.view` | View | Voir les budgets | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Budget | `/finance/budgets` | `finance-budgets.create` | Create | Créer un budget | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Budget | `/finance/budgets` | `finance-budgets.update` | Update | Modifier un budget / ajouter une ligne | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Résumé (dashboard) | `/dashboard` | `finance-summary.view` | View | Voir le résumé financier | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Facturation | `/finance/invoices` | `finance-invoices.view` | View | Voir les factures | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — |
| Facturation | `/finance/invoices` | `finance-invoices.create` | Create | Créer une facture | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Facturation | `/finance/invoices` | `finance-invoices.update` | Update | Modifier une facture en brouillon | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Facturation | `/finance/invoices` | `finance-invoices.issue` | Autre (issue) | Émettre une facture | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Facturation | `/finance/invoices` | `finance-invoices.cancel` | Autre (cancel) | Annuler une facture | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Facturation — paiements | `/finance/invoices` | `finance-payments.view` | View | Voir les paiements | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — |
| Facturation — paiements | `/finance/invoices` | `finance-payments.create` | Create | Enregistrer un paiement | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — |
| Facturation — avoirs | `/finance/invoices` | `finance-credit-notes.view` | View | Voir les avoirs | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Facturation — avoirs | `/finance/invoices` | `finance-credit-notes.create` | Create | Émettre un avoir | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Budget | `/finance/budgets` | `finance-budgets.check-overspend` | Autre (check-overspend) | Vérifier les dépassements budgétaires | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |

### Hébergement

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Chambres (types) | `/hebergement/rooms` | `room-types.view` | View | Voir les types de chambres | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Chambres (types) | `/hebergement/rooms` | `room-types.create` | Create | Créer un type de chambre | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Chambres (types) | `/hebergement/rooms` | `room-types.update` | Update | Modifier un type de chambre | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Chambres | `/hebergement/rooms` | `rooms.view` | View | Voir les chambres | ✅ | ✅ | ✅ | — | — | ✅ | — | — | ✅ |
| Chambres | `/hebergement/rooms` | `rooms.create` | Create | Créer une chambre | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Chambres | `/hebergement/rooms` | `rooms.update` | Update | Modifier une chambre | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Clients | `/hebergement/guests` | `guests.view` | View | Voir les clients | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Clients | `/hebergement/guests` | `guests.create` | Create | Créer un client | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Clients | `/hebergement/guests` | `guests.update` | Update | Modifier un client | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Réservations | `/hebergement/reservations` | `reservations.view` | View | Voir les réservations | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Réservations | `/hebergement/reservations` | `reservations.create` | Create | Créer une réservation | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Réservations | `/hebergement/reservations` | `reservations.update` | Update | Modifier une réservation en attente | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Réservations | `/hebergement/reservations` | `reservations.confirm` | Autre (confirm) | Confirmer une réservation | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Réservations | `/hebergement/reservations` | `reservations.check-in` | Autre (check-in) | Enregistrer l'arrivée | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Réservations | `/hebergement/reservations` | `reservations.check-out` | Autre (check-out) | Enregistrer le départ | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Réservations | `/hebergement/reservations` | `reservations.cancel` | Autre (cancel) | Annuler une réservation | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Réservations | `/hebergement/reservations` | `reservations.no-show` | Autre (no-show) | Marquer non présentée | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |

### RH & Paie

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Employés | `/hr/employees` | `employees.view` | View | Voir les employés | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Employés | `/hr/employees` | `employees.create` | Create | Créer un employé | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Employés | `/hr/employees` | `employees.update` | Update | Modifier un employé | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Planning | — | `work-schedules.view` | View | Voir le planning | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Planning | — | `work-schedules.create` | Create | Créer un créneau | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Planning | — | `work-schedules.update` | Update | Modifier un créneau | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Présence | `/hr/attendance` | `attendance.view` | View | Voir les présences | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Présence | `/hr/attendance` | `attendance.create` | Create | Pointer une arrivée | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Présence | `/hr/attendance` | `attendance.clock-out` | Autre (clock-out) | Pointer un départ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Congés | `/hr/leave` | `leave-requests.view` | View | Voir les demandes de congé | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Congés | `/hr/leave` | `leave-requests.create` | Create | Créer une demande | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Congés | `/hr/leave` | `leave-requests.update` | Update | Modifier une demande en attente | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Congés | `/hr/leave` | `leave-requests.approve` | Approve | Approuver une demande | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Congés | `/hr/leave` | `leave-requests.reject` | Reject | Rejeter une demande | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Congés | `/hr/leave` | `leave-requests.cancel` | Autre (cancel) | Annuler une demande | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Paie | `/hr/payroll` | `payslips.view` | View | Voir les bulletins | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Paie | `/hr/payroll` | `payslips.create` | Create | Créer un bulletin | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Paie | `/hr/payroll` | `payslips.update` | Update | Modifier un bulletin en brouillon | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Paie | `/hr/payroll` | `payslips.finalize` | Autre (finalize) | Finaliser un bulletin | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Paie | `/hr/payroll` | `payslips.mark-paid` | Pay | Marquer payé | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |

### Achats

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Fournisseurs | `/purchases` | `suppliers.view` | View | Voir les fournisseurs | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Fournisseurs | `/purchases` | `suppliers.create` | Create | Créer un fournisseur | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Fournisseurs | `/purchases` | `suppliers.update` | Update | Modifier un fournisseur | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Demandes d'achat | `/purchases` | `purchase-requests.view` | View | Voir les demandes d'achat | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Demandes d'achat | `/purchases` | `purchase-requests.create` | Create | Créer une demande | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Demandes d'achat | `/purchases` | `purchase-requests.update` | Update | Modifier une demande en attente | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Demandes d'achat | `/purchases` | `purchase-requests.approve` | Approve | Approuver une demande | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Demandes d'achat | `/purchases` | `purchase-requests.reject` | Reject | Rejeter une demande | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Demandes d'achat | `/purchases` | `purchase-requests.cancel` | Autre (cancel) | Annuler une demande | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Commandes d'achat | `/purchases` | `purchase-orders.view` | View | Voir les commandes | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Commandes d'achat | `/purchases` | `purchase-orders.create` | Create | Créer une commande | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Commandes d'achat | `/purchases` | `purchase-orders.update` | Update | Modifier une commande en brouillon | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Commandes d'achat | `/purchases` | `purchase-orders.send` | Autre (send) | Envoyer au fournisseur | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Commandes d'achat | `/purchases` | `purchase-orders.cancel` | Autre (cancel) | Annuler une commande | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Réceptions | `/purchases` | `goods-receipts.view` | View | Voir les réceptions | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Réceptions | `/purchases` | `goods-receipts.create` | Create | Enregistrer une réception | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |

### Housekeeping

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tâches de ménage | `/housekeeping` | `housekeeping-tasks.view` | View | Voir les tâches de ménage | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ |
| Tâches de ménage | `/housekeeping` | `housekeeping-tasks.create` | Create | Signaler une chambre à nettoyer | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ |
| Tâches de ménage | `/housekeeping` | `housekeeping-tasks.clean` | Autre (clean) | Marquer nettoyée | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ |
| Tâches de ménage | `/housekeeping` | `housekeeping-tasks.inspect` | Autre (inspect) | Marquer inspectée | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ |

### Maintenance

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Actifs / équipements | `/maintenance` | `assets.view` | View | Voir les actifs | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Actifs / équipements | `/maintenance` | `assets.create` | Create | Créer un actif | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Actifs / équipements | `/maintenance` | `assets.update` | Update | Modifier un actif | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Demandes | `/maintenance` | `maintenance-requests.view` | View | Voir les demandes | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Demandes | `/maintenance` | `maintenance-requests.create` | Create | Créer une demande | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Demandes | `/maintenance` | `maintenance-requests.update` | Update | Modifier une demande en attente | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Demandes | `/maintenance` | `maintenance-requests.approve` | Approve | Approuver une demande | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Demandes | `/maintenance` | `maintenance-requests.reject` | Reject | Rejeter une demande | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Demandes | `/maintenance` | `maintenance-requests.cancel` | Autre (cancel) | Annuler une demande | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Interventions | `/maintenance` | `maintenance-interventions.view` | View | Voir les interventions | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Interventions | `/maintenance` | `maintenance-interventions.create` | Create | Planifier une intervention | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Interventions | `/maintenance` | `maintenance-interventions.update` | Update | Modifier une intervention planifiée | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Interventions | `/maintenance` | `maintenance-interventions.start` | Autre (start) | Démarrer une intervention | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Interventions | `/maintenance` | `maintenance-interventions.complete` | Autre (complete) | Terminer une intervention | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| Interventions | `/maintenance` | `maintenance-interventions.cancel` | Autre (cancel) | Annuler une intervention | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |

### Stocks

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Entrepôts | `/stocks/warehouses` | `warehouses.view` | View | Voir les entrepôts | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Entrepôts | `/stocks/warehouses` | `warehouses.create` | Create | Créer un entrepôt | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Entrepôts | `/stocks/warehouses` | `warehouses.update` | Update | Modifier un entrepôt | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Articles | `/stocks/products` | `products.view` | View | Voir les produits et leur stock | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — |
| Articles | `/stocks/products` | `products.create` | Create | Créer un produit | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Articles | `/stocks/products` | `products.update` | Update | Modifier un produit | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Articles | `/stocks/products` | `products.check-low-stock` | Autre (check-low-stock) | Vérifier les seuils de stock minimum | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Mouvements | `/stocks/movements` | `stock-movements.view` | View | Voir les mouvements | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ | — |
| Mouvements | `/stocks/movements` | `stock-movements.create` | Create | Enregistrer un mouvement | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Mouvements | `/stocks/movements` | `stock-movements.transfer` | Autre (transfer) | Transférer entre entrepôts | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |
| Mouvements | `/stocks/movements` | `stock-movements.adjustment` | Autre (adjustment) | Ajuster après inventaire | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — |

### Système

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rapports | `/reports` | `reports.financial.view` | Autre (financial.view) | Voir/exporter le rapport financier | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Notifications | `/notifications` | `notifications.view` | View | Voir ses notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notifications | `/notifications` | `notifications.mark-read` | Autre (mark-read) | Marquer comme lues | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audit | `/audit-logs` | `audit-logs.view` | View | Voir le journal d'audit | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Supervision plateforme | — | `system-monitoring.view` | View | Voir les métriques de supervision système | ✅ | — | — | — | — | — | — | — | — |

### Nimba AI

| Sous-module | Route | Permission | Action | Description | SA | BO | DH | RF | RH | RE | RS | RM | HK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Assistant / Insights | `/nimba-ai` | `nimba-ai.use` | Autre (use) | Utiliser Nimba AI (insights, anomalies, assistant) | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
