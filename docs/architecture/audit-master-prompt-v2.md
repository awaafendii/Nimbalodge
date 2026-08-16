# Audit technique — NimbaLodge ERP (Master Prompt V2, Phase 0)

Audit du dépôt tel qu'il existe aujourd'hui, produit sans modification de code, conformément à la
consigne "PHASE 0 — AUDIT TECHNIQUE" du Master Prompt V2. Aucune ligne de code n'a été touchée pour
produire ce rapport.

**Note de nommage** : le Master Prompt V2 définit sa propre numérotation "PHASE 0" → "PHASE 15".
Le dépôt a déjà sa propre numérotation de phases (0 à 14, voir `docs/architecture/phase-*.md`),
sans rapport avec celle du Master Prompt. Pour éviter toute confusion, ce document utilise
**MP-Phase N** pour désigner les phases du Master Prompt, et **Phase N** (sans préfixe) pour les
phases déjà réalisées et documentées dans ce dépôt. La section W propose une réconciliation des
deux numérotations.

---

## A. Architecture actuelle

Monorepo npm workspaces :

```
apps/api        NestJS + Prisma + PostgreSQL — API métier complète
apps/web        React 18 + Vite + TanStack Query + Zustand + React Router + Tailwind
packages/ui     Design system partagé (composants shadcn-style)
packages/utils  Formatage (fmtGNF, fmtUSD, dates...) — port du prototype legacy
packages/types  Placeholder vide (`export {}`) — jamais peuplé
packages/config Placeholder vide (package.json + README seulement)
prisma/         schema.prisma + migrations/ + seed.ts + bootstrap-production.ts + permissions-catalog.ts
docs/           architecture/ (14 docs de phase + 1 audit) + deployment/ (render.md) + legacy/ (2 HTML)
nimbalodge-app/ Prototype React legacy — HORS workspaces, gelé, non touché depuis la Phase 0 initiale
```

Le prototype legacy (`nimbalodge-app/`) reste au niveau racine du dépôt, pas dans `docs/legacy/` —
seuls deux fichiers HTML statiques (`djoliba-app.html`, `site-djoliba-hotels-guinee.html`) ont été
physiquement déplacés dans `docs/legacy/`. `nimbalodge-app/` lui-même n'est déjà plus dans le build
(absent de `workspaces` dans `package.json` racine) mais reste à sa place d'origine.

Version courante : 14 phases de développement backend/frontend déjà livrées et documentées
individuellement (`docs/architecture/phase-1-*.md` à `phase-14-*.md`), plus une préparation de
déploiement Render (`render.yaml`, `docs/deployment/render.md`).

---

## B. Backend existant

NestJS, `apps/api/src/`, préfixe global `/api/v1`. ~30 modules métier, un par entité principale
(granularité "un module par entité", pas de méga-modules) :

```
auth, permissions, roles, users, organizations, hotels, departments, activities, cost-centers,
financial-categories, cash-accounts, bank-accounts, revenues, expenses, budgets, invoices,
room-types, rooms, guests, reservations, employees, work-schedules, attendance, leave-requests,
payslips, suppliers, purchase-requests, purchase-orders (+ goods-receipts en sous-ressource),
housekeeping-tasks, assets, maintenance-requests, maintenance-interventions, reports,
notifications, audit-logs, warehouses, stock-movements, products, finance-summary
```

Infrastructure transverse (`apps/api/src/common/`) : `JwtAuthGuard` (global, `@Public()` pour
bypasser), `PermissionsGuard` (global, `@RequirePermissions()`), `AuditInterceptor` (global,
requêtes mutantes uniquement), `CurrentUser` decorator. `ThrottlerGuard` global + throttle renforcé
sur `/auth/login`/`/auth/refresh`. `helmet()` activé. CORS mono-origine (`CORS_ORIGIN`, un seul
domaine autorisé, pas de liste).

---

## C. Frontend existant

`apps/web/src/`. Fondation d'authentification réelle depuis la Phase 14 (`stores/auth-store.ts`,
`services/api-client.ts` avec refresh-on-401 mutex, `components/auth/require-auth.tsx`, nav filtrée
par permission réelle). Composant `QueryState` générique (loading/erreur/vide/403) utilisé par les
3 modules déjà branchés. `OfflineBanner` (détection online/offline basique, pas de sync engine).

Structure actuelle (voir section W pour la comparer à la cible du Master Prompt §36) :

```
app/            router, providers, query-client
components/     auth/, common/ (QueryState, OfflineBanner, ComingSoon, loaders), layout/ (AppShell, Sidebar, Topbar)
features/       un dossier par module de nav (14, dont auth/)
hooks/          use-auth, use-departments, use-finance, use-finance-entries, use-hotels, use-online-status
services/       api-client, auth, departments, finance, finance-entries, hotels
stores/         auth-store, ui-store
theme/          theme-provider
```

Pas encore de `guards/`, `layouts/` (pluriel), `schemas/` (Zod), `lib/` séparés — tout est plat dans
les dossiers ci-dessus. Pas de React Hook Form ni Zod installés.

---

## D. Modèle Prisma

47 modèles dans `prisma/schema.prisma`, organisés par phase (commentaires en tête de fichier) :

```
Organization, Hotel, Department, DepartmentActivity, CostCenter, UserDepartment,
User, Role, Permission, RolePermission, UserRole, RefreshToken,
FinancialCategory, CashAccount, BankAccount, CashTransaction, BankTransaction,
Revenue, Expense, Budget, BudgetLine,
Invoice, InvoiceLine, Payment, CreditNote,
RoomType, Room, Guest, Reservation,
Employee, WorkSchedule, Attendance, LeaveRequest, Payslip,
Supplier, PurchaseRequest, PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine,
HousekeepingTask, Asset, MaintenanceRequest, MaintenanceIntervention,
Notification, AuditLog,
Product, Warehouse, StockMovement
```

11 migrations appliquées (`prisma/migrations/`), toutes générées via un contournement documenté
(`prisma migrate diff --from-url ... --script`, `prisma migrate dev` échouant systématiquement sur
cet environnement Windows — voir `docs/architecture/phase-6-billing.md`).

Montants systématiquement en `Decimal @db.Decimal(14,2)` (jamais `Float`). Soldes/totaux/quantités
**jamais dénormalisés** — toujours recalculés à la demande depuis les mouvements (`CashAccount`
balance, `Invoice` totaux, `PurchaseOrder` quantité reçue, `StockMovement` stock courant). C'est un
principe appliqué avec une cohérence remarquable sur l'ensemble du schéma.

---

## E. Routes API

Une ressource REST par module (voir liste B), format `resource.action` ou `finance.resource.action`
selon le domaine (voir section J pour la justification et l'incohérence que ça introduit). Total
~150 endpoints. Domaines couverts : tout ce que liste le Master Prompt §51, à l'exception de
`analytics` (n'existe pas comme domaine séparé — les KPIs vivent dans `finance-summary` et
`reports`).

---

## F. Routes frontend

`app/router.tsx` — une route publique (`/login`), tout le reste derrière `RequireAuth` + `AppShell` :

```
/dashboard  /finance  /reservations  /rooms  /guests  /hr  /payroll
/purchases  /inventory  /housekeeping  /maintenance  /reports  /notifications  /settings
```

Pas de routes `/onboarding`, pas de sélecteur d'organisation/hôtel dans l'URL (single-tenant
implicite côté navigation — l'API est multi-tenant, le routing frontend ne l'exploite pas encore).

---

## G. Modules fonctionnels (backend + frontend branchés)

Seulement **3 sur 14** ont un frontend réellement connecté à l'API (voir `docs/architecture/
phase-14-frontend-connection.md`) :

| Module | Couverture frontend réelle |
|---|---|
| Tableau de bord | KPIs du mois courant (`GET /finance/summary`) uniquement — pas de comparaison multi-période, pas d'occupation |
| Paramètres | Hôtel (lecture) + Départements (CRUD complet) + création d'hôtel (org-wide) |
| Finance | Recettes (liste+création) + Dépenses (liste+création+workflow DRAFT→PAID) — **pas** Budget/Caisse/Banque/Facturation/Rapports dans l'UI, alors que le backend les expose tous |

---

## H. Modules ComingSoon (backend prêt, frontend placeholder)

11 modules — le backend de chacun est **complet et vérifié en base réelle** (voir leur doc de
phase respective), seul le frontend manque :

```
Réservations (Phase 7)   Chambres (Phase 7)      Clients (Phase 7)
RH (Phase 8)              Paie (Phase 8)
Achats (Phase 9)
Stock (Phase 13)
Housekeeping (Phase 10)   Maintenance (Phase 10)
Rapports (Phase 11)
Notifications (Phase 12)
```

Le composant `ComingSoon` affiche déjà le message correct ("l'API existe, cet écran n'est pas
encore branché") depuis la Phase 14 — pas besoin de le corriger, juste de le remplacer module par
module.

---

## I. Authentification

JWT access (15 min) + refresh (7 jours, rotation à chaque usage, révocable — `RefreshToken.tokenHash`
en SHA-256, jamais le token brut stocké). `bcrypt` coût 12. Colonnes `twoFactorEnabled`/
`twoFactorSecret` préparées sur `User` mais **aucun flow TOTP implémenté** — c'est un placeholder de
schéma, pas une fonctionnalité (documenté explicitement comme tel depuis la Phase 3). **Aucune**
vérification d'email, **aucun** flow de réinitialisation de mot de passe, **aucune** gestion de
session/appareil visible côté utilisateur. `/auth/login` et `/auth/refresh` throttlés (5/60s) — les
autres endpoints n'ont que le throttle global par défaut (100/60s).

**Risque de production concret** : un administrateur réel qui perd son mot de passe n'a **aucun**
moyen de le récupérer — le bootstrap de production (`prisma/bootstrap-production.ts`) ne touche
jamais un compte existant (idempotence volontaire), et aucune UI de reset n'existe.

---

## J. RBAC

`Permission(key)` + `Role` (`organizationId` nul = rôle système global) + `RolePermission` +
`UserRole`. Deux rôles seedés : `SUPER_ADMIN` (global, toutes permissions) et `HOTEL_ADMIN`
(scopé organisation, tout sauf quelques contrôles org-level comme `finance.expense.book`).

**Incohérence de format** (déjà documentée comme un choix assumé phase par phase, mais reste une
vraie incohérence à l'échelle du projet) : les domaines Phase 3-4 et Phase 7-13 utilisent un format
plat `resource.action` (`departments.view`), le domaine Finance (Phase 5-6 + `finance.budget.
check-overspend`) utilise un format imbriqué `finance.resource.action`. Le Master Prompt §14 demande
une "convention uniforme" — c'est un renommage à fort rayon d'impact (toutes les clés seedées + tous
les `@RequirePermissions()` du code + tout hardcodage frontend dans `nav-config.tsx`), pas un
simple nettoyage.

**Écart le plus significatif vis-à-vis du modèle cible du Master Prompt (§13)** : `UserDepartment`
(table de jointure utilisateur↔département) existe dans le schéma depuis la Phase 4 mais
**n'est utilisée nulle part** — aucun guard, aucune requête ne la lit. Le scope d'accès réel
s'arrête aujourd'hui à `organization_id`/`hotel_id`. Un "responsable Restaurant" tel que décrit au
§13 n'existe pas encore comme concept appliqué : n'importe quel utilisateur avec les bonnes
permissions voit/agit sur **tout** son hôtel, pas seulement son département.

Aucun CRUD d'écriture sur `Role`/`Permission` n'existe (lecture seule) — pas de rôles personnalisés
créables depuis l'UI malgré le schéma le permettant (`Role.organizationId` non-nul = rôle custom).

---

## K. Multi-tenancy

Isolation `organizationId`/`hotelId` appliquée de façon cohérente dans **chaque** service via un
pattern `assertInScope()` — mais ce pattern est **dupliqué texto dans ~40 fichiers de service**
plutôt que centralisé (un guard ou un provider partagé). Fonctionnellement correct (vérifié
manuellement à chaque phase), mais c'est de la dette : toute évolution de la règle d'isolation
demande une modification dans 40 endroits.

**Aucun test automatisé** ne vérifie cette isolation — chaque phase l'a vérifiée manuellement via
`curl` pendant son développement, sans suite de non-régression qui la re-vérifie après coup.

---

## L. Département / activité / centre de coût

Conforme à la cible du Master Prompt §10-12 : rien n'est codé en dur, chaque hôtel crée ses propres
départements/activités/centres de coûts via l'API réelle, contraintes d'unicité par hôtel. C'est le
domaine le plus proche de "terminé" au sens strict du Master Prompt — le seul écart est
`UserDepartment` non exploité (voir section J).

---

## M. Finance

Le domaine le plus construit du backend : `FinancialCategory`, `CashAccount`/`BankAccount` (solde
calculé à la demande), `Revenue` (sans statut, finalisée à la création), `Expense` (workflow
DRAFT→PENDING→APPROVED→REJECTED→PAID→BOOKED), `Budget`/`BudgetLine` (exécution calculée à la
demande), `Invoice`/`InvoiceLine`/`Payment`/`CreditNote` (facturation client complète, numérotation
séquentielle par hôtel), moteur de rapport paramétrable avec export CSV/Excel/PDF réel.

**Distinction Revenue/Payment (Master Prompt §19)** : déjà correctement séparée — `Payment` ne crée
jamais de `Revenue`, `FinanceSummaryService` additionne les deux sources sans double-comptage
(vérifié en base réelle Phase 6). Mais **aucun test automatisé** ne garantit que ça reste vrai après
une future modification, et **aucun fichier `docs/business-rules/finance.md`** n'existe — la règle
vit dispersée dans `docs/architecture/phase-5-finance.md` et `phase-6-billing.md`, pas centralisée
comme le Master Prompt §19 le demande explicitement.

Frontend : seuls Recettes et Dépenses sont branchés (voir section G) — Budget, Caisse, Banque et
Facturation ont un backend complet mais aucune UI.

---

## N. Audit

`AuditLog` + `AuditInterceptor` global, actif sur toute requête mutante (POST/PATCH/PUT/DELETE).
Capture `method`/`path`/`resourceType`/`outcome` (SUCCESS/FAILURE)/`userId`/`organizationId`/
`hotelId`/`ipAddress`. **Pas de capture `before`/`after`** (Master Prompt §44 le demande
explicitement) — un `PATCH` modifiant un montant n'enregistre pas l'ancienne/nouvelle valeur,
seulement qu'une requête a réussi. Pas d'étiquetage sémantique des événements `LOGIN`/`LOGOUT`/
`PERMISSION_CHANGE` — ce sont juste des `POST /auth/login` génériques dans le journal, indiscernables
d'une autre requête POST sans lire le `path`. `GET /audit-logs` limité à 200 résultats (seule liste
paginée du projet — voir section Q).

---

## O. Design System

`packages/ui` contient : `Button`, `Card`, `Badge`, `Dialog`, `Sheet`, `ToggleGroup`, `Separator`,
`DropdownMenu`, `Avatar`, `Tooltip`, `Skeleton`, `KpiCard`, `Input`, `Label`, un set d'icônes maison
(`Icons.*`).

**Écart majeur vis-à-vis de la cible §37** : ni `Select`, `Combobox`, `Textarea`, `Checkbox`,
`Switch`, `Drawer`, `Popover`, `Table`/`DataTable`, `Pagination`, `DatePicker`, `Form` (wrapper React
Hook Form), `CurrencyInput`, `FileUpload`, `Alert`/`Toast`, `ConfirmDialog`, `Tabs`, `Breadcrumb`,
`Command`, `ChartContainer`, `Timeline` n'existent. Les listes actuelles (Départements, Recettes,
Dépenses) sont des `<ul>` stylées à la main, les selects des `<select>` HTML natifs. **`DataTable`
(§38, priorité explicite du Master Prompt) n'existe pas du tout** — c'est le composant le plus
structurant manquant avant de construire les 11 modules restants à l'échelle prévue (recherche,
tri, pagination serveur, sélection multiple, export).

---

## P. Tests

**Aucun test automatisé n'existe dans le dépôt** — zéro fichier `.spec.ts`/`.test.ts` dans `apps/`
ou `packages/`. Toute la vérification faite jusqu'ici (14 phases) l'a été manuellement : scripts
`curl` contre une base réelle pendant le développement de chaque phase, plus quelques vérifications
Chrome réelles pour les 3 modules frontend branchés. C'est **l'écart le plus important** entre l'état
actuel et le Master Prompt §45, qui exige unit/integration/e2e/security côté backend et
component/form/permission/workflow/e2e côté frontend.

---

## Q. Dette technique

| Élément | Nature |
|---|---|
| `assertInScope()` dupliqué dans ~40 services | Pas de guard/provider partagé — modification de la règle d'isolation = 40 fichiers à toucher |
| Format de permission incohérent (plat vs `finance.*`) | Documenté comme choix assumé phase par phase, reste incohérent à l'échelle globale |
| `UserDepartment` non exploité | Table présente, jamais lue par aucun guard/query |
| Aucun `DataTable`/pagination serveur (sauf `AuditLog`, `take:200` en dur) | Toute liste charge l'intégralité des lignes — non viable à volume réel |
| `packages/types` et `packages/config` vides | Placeholders jamais peuplés depuis la Phase 1 |
| `nimbalodge-app/` toujours à la racine | Fonctionnellement gelé (hors workspaces) mais pas physiquement archivé dans `docs/legacy/`/`archive/` |
| Aucun CI/CD | Pas de `.github/workflows/` — chaque déploiement dépend d'une vérification manuelle |
| Aucun logging structuré / error tracking / métriques | Logger Nest par défaut uniquement, `/health` seul endpoint d'observabilité |
| Aucun upload de fichier réel | Tous les champs "document"/"justificatif" (`attachmentReference`, etc.) sont du texte libre — décision documentée à chaque phase, jamais implémentée |
| Rate limiting minimal | Seuls `/auth/login`/`/auth/refresh` sont throttlés au-delà du défaut global |

---

## R. Risques de production

1. **Aucun test = aucun filet de sécurité contre les régressions.** Le plus grand risque à mesure
   que le nombre de modules frontend/backend grandit.
2. **Aucune récupération de mot de passe.** Un admin réel bloqué dehors n'a aucun recours
   applicatif.
3. **Base Postgres gratuite Render expirant à 90 jours** (déjà documenté dans `docs/deployment/
   render.md`) — perte de données réelle si non anticipé.
4. **Scope départemental non appliqué** (§13) — tout utilisateur voit/agit sur l'intégralité de son
   hôtel, pas seulement son département, malgré le modèle de données déjà prêt pour le restreindre.
5. **Audit sans before/after** — valeur forensique limitée en cas d'incident (on sait "qui a fait
   quoi quand", pas "quelle valeur a changé vers quoi").
6. **Aucun CI/CD** — la qualité de chaque déploiement dépend entièrement de la discipline manuelle
   (`npm run typecheck`/`build` avant de pousser), pas d'un pipeline qui l'impose.
7. **Pas de sauvegarde formalisée** au-delà de ce que le plan Render inclut par défaut.

---

## S/T/U/V. Fichiers — à conserver / corriger / refactoriser / reconstruire / supprimer

| Catégorie | Éléments | Justification |
|---|---|---|
| **CONSERVER** | Architecture NestJS/Prisma complète, les 47 modèles, l'historique de migrations, `packages/ui` existant, le pattern `api-client`/`auth-store`/`QueryState`/`RequireAuth` (Phase 14), la structure "un module par entité" | Solide, cohérent, vérifié en base réelle à chaque étape — rien ici ne justifie une réécriture |
| **À CORRIGER** (ciblé, pas une refonte) | Extraction d'`assertInScope()` en guard/provider partagé ; application réelle de `UserDepartment` ; `docs/business-rules/finance.md` à créer (contenu déjà écrit, juste dispersé) ; déplacer `nimbalodge-app/` vers `docs/legacy/` ou `archive/` | Corrections localisées, faible risque, fort gain de maintenabilité |
| **À REFACTORISER** | `packages/ui` (ajout des composants manquants, priorité `DataTable`) avant de construire les 11 modules restants à l'échelle cible ; convention de permission (harmonisation, fort rayon d'impact — nécessite un plan dédié, pas un simple renommage) | Nécessaire avant d'industrialiser le reste du frontend, mais pas une réécriture de l'existant |
| **À RECONSTRUIRE** | Aucun élément du dépôt ne justifie une reconstruction complète | Le socle backend est solide ; rien n'est assez dégradé pour ça |
| **À SUPPRIMER** | Rien techniquement — même `nimbalodge-app/` garde une valeur de référence design explicitement revendiquée par le Master Prompt lui-même (§5 : "ils servent uniquement de référence historique/design") | Aucune suppression nette recommandée à ce stade |

---

## W. Plan d'exécution détaillé — réconciliation des deux numérotations

Le Master Prompt V2 propose 16 phases (MP-Phase 0 à 15). Une large partie du backend qu'il décrit
existe déjà (Phases 1-13 de ce dépôt) — le plan ci-dessous n'est donc pas "recommencer au MP-Phase 1",
mais reprendre le fil là où le dépôt en est réellement, en respectant l'esprit du Master Prompt.

| MP-Phase | Contenu demandé | État réel dans ce dépôt |
|---|---|---|
| MP-0 Audit | Ce document | **Fait** (ce rapport) |
| MP-1 Hardening backend | multi-tenancy, scope département, RBAC, validation, intégrité finance, audit, sécurité | **Partiel** — multi-tenancy/validation/intégrité finance déjà solides ; scope département, format RBAC uniforme, audit before/after restent à faire |
| MP-2 Finance production | recettes/dépenses/budgets/caisse/banque/facturation/paiements/rapports + tests | **Backend fait** (Phases 5-6-11) ; tests manquants ; `docs/business-rules/finance.md` à créer |
| MP-3 Design System | industrialiser `packages/ui` | **À faire** — `DataTable` en priorité |
| MP-4 Frontend core | auth, onboarding, app shell, hotel switcher, department switcher, nav, zero-data | **Partiel** — auth/app shell/nav/zero-data faits (Phase 14) ; onboarding, hotel switcher, department switcher absents |
| MP-5 Frontend Finance | dashboard/recettes/dépenses/budgets/caisse/banques/facturation/rapports | **Partiel** — recettes/dépenses faits ; budgets/caisse/banque/facturation/rapports restent |
| MP-6 à MP-11 | Hôtel, RH, Achats/Stocks, Housekeeping/Maintenance, Reporting/Analytics, Notifications/Audit UI | **Backend fait pour les 11**, frontend = `ComingSoon` partout (voir section H) |
| MP-12 Mobile | `apps/mobile/` | **Non commencé** |
| MP-13 Offline | cache local, mutation queue, sync engine | **Non commencé** (juste une détection online/offline basique) |
| MP-14 Nimba AI | architecture préparatoire uniquement | **Non commencé** |
| MP-15 Production hardening | sécurité, perf, monitoring, backups, CI/CD | **Non commencé** (au-delà du déploiement Render lui-même) |

### Proposition d'ordre concret pour la suite (à valider avec toi avant de commencer)

1. **Corrections ciblées à faible risque** — extraction `assertInScope()`, `docs/business-rules/
   finance.md`, archivage physique de `nimbalodge-app/`. Petit, réversible, améliore la base sans
   rien casser.
2. **Fondation de tests** — au minimum : isolation multi-tenant, intégrité finance (une recette ne
   produit jamais deux encaissements), workflow Expense. Sans ça, chaque phase suivante ajoute du
   risque de régression silencieuse.
3. **`DataTable` + composants manquants prioritaires** dans `packages/ui` — bloquant pour construire
   les 11 modules `ComingSoon` à l'échelle voulue (recherche/tri/pagination/export).
4. **Reprendre le branchement frontend module par module**, dans l'ordre de priorité déjà donné par
   le Master Prompt §54 (Guests → Rooms → Reservations → HR → Payroll → Purchases → Inventory →
   Housekeeping → Maintenance → Reports → Notifications), en complétant aussi Finance (Budget/
   Caisse/Banque/Facturation) qui n'est qu'à moitié branché malgré son backend complet.
5. **Scope départemental réel** (`UserDepartment` appliqué) — changement transversal, à faire une
   fois qu'une suite de tests existe pour le sécuriser.
6. Mobile / offline / IA / hardening final — dans cet ordre, une fois le cœur métier entièrement
   branché et testé.

**Je n'ai rien modifié dans le code pour produire ce rapport.** Dis-moi par quel point tu veux que
je commence — je recommande l'étape 1 (corrections ciblées) suivie de l'étape 2 (fondation de
tests) avant de reprendre la construction de nouveaux écrans, mais c'est ton produit et ta décision.
