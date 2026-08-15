# Phase 5 — Finance : recettes, dépenses, budgets, catégories, caisse, banque

Décisions prises pour le premier vrai flux d'argent de l'ERP, en respectant la hiérarchie posée
en Phases 3-4 (Organisation→Hôtel→Département→Activité→CostCenter→User) comme dimensions
d'analyse (§46). `apps/web` reste inchangé (`features/finance` reste `ComingSoon`). Aucun
`Invoice`/`Guest`/`Supplier` réel — Phases 6/7/9.

## Montants en `Decimal`, jamais `Float`

Tous les champs monétaires en `Decimal @db.Decimal(14, 2)` (§52 — précision exacte PostgreSQL
`numeric`, aucune erreur d'arrondi). DTO : `number` JS + `@IsNumber({maxDecimalPlaces:2})
@Min(0.01)`. Les réponses API sérialisent les montants comme des **chaînes** (comportement
standard de Decimal.js/`toJSON()`), pas des `number` — préserve la précision, à charge du
consommateur de parser si besoin.

## `FinancialCategory` : un modèle, `hotelId` requis

Un seul modèle avec `type: FinancialCategoryType` (`REVENUE`/`EXPENSE`) plutôt que deux tables —
même forme, évite de dupliquer le CRUD. `hotelId` requis (pas de template org-wide) : §9 dit
explicitement "configurables **par hôtel**", cohérent avec `@@unique([hotelId, name])` déjà
utilisé pour `Department`/`CostCenter`. Le `type` n'est pas modifiable après création (éviterait
de reclasser rétroactivement le sens des `Revenue`/`Expense` déjà rattachées).

## `PaymentMethod` = enum, pas de table

`CASH BANK_TRANSFER MOBILE_MONEY CARD CHECK OTHER`. La vraie destination des fonds est déjà
modélisée via `cashAccountId`/`bankAccountId` — une table CRUD dédiée serait redondante pour un
petit ensemble fermé standard. Réévaluable si Phase 6 (paiements clients) a un besoin plus riche.

## Solde caisse/banque calculé à la volée

`CashAccount`/`BankAccount` stockent uniquement `openingBalance` ; le solde =
`openingBalance + Σ(IN) − Σ(OUT)` des transactions, agrégé à la demande
(`CashAccountsService.computeBalance()`/`BankAccountsService.computeBalance()`) — même principe
que `runningBalance()`/`ledgerTotals()` du prototype legacy (`nimbalodge-app/src/data/ledger.js`).
Évite toute désynchronisation. **Pas de clôture de caisse** (solde théorique/réel/écart) cette
phase — aucun workflow de réconciliation physique n'est nommé par le titre de phase, non
spécifié ailleurs au brief ; `openingBalance` n'est pas modifiable après création (fausserait
rétroactivement le solde calculé).

## Revenue/Expense → Caisse/Banque : XOR, et moment de la transaction

Deux FKs nullables `cashAccountId`/`bankAccountId` sur `Revenue`/`Expense`, exactement un des
deux requis (validé en service, pas en contrainte DB — même pattern que `managerId` en Phase 4).

- **Revenue** : la `CashTransaction`/`BankTransaction` est créée **atomiquement**
  (`prisma.$transaction`) **à la création même** de la recette — §12 ne décrit aucune étape de
  validation intermédiaire. `Revenue` n'a **pas de statut** : contrairement à `Expense`, le brief
  ne détaille aucun cycle de vie ; un champ à une seule valeur atteignable serait de la
  sur-ingénierie.
- **Expense** : la transaction n'est créée **qu'au passage à PAYÉ** (`POST
  /expenses/:id/mark-paid`), jamais avant — un brouillon ou une dépense approuvée n'a pas encore
  bougé d'argent réel. Point vérifié explicitement en base réelle (solde inchangé jusqu'au
  paiement).

## Workflow `Expense` — endpoints d'action dédiés

`ExpenseStatus {DRAFT PENDING APPROVED REJECTED PAID BOOKED}`. Le brief §13 liste SOUMIS puis EN
ATTENTE comme deux états distincts — fusionnés en un seul `PENDING` (rien ne les différencie
fonctionnellement, même acteur, aucune action intermédiaire). `REJECTED` ajouté pragmatiquement
(non littéralement nommé au brief) : "approuver" implique une branche négative possible.

Endpoints dédiés par transition (effets de bord et permissions différents), pas de `PATCH`
générique de statut :

| Endpoint | Transition | Permission |
|---|---|---|
| `POST /expenses` | — → DRAFT | `finance.expense.create` |
| `PATCH /expenses/:id` | DRAFT seulement | `finance.expense.update` |
| `POST /expenses/:id/submit` | DRAFT → PENDING | `finance.expense.submit` |
| `POST /expenses/:id/approve` | PENDING → APPROVED | `finance.expense.approve` |
| `POST /expenses/:id/reject` | PENDING → REJECTED | `finance.expense.approve` |
| `POST /expenses/:id/mark-paid` | APPROVED → PAID | `finance.expense.pay` |
| `POST /expenses/:id/book` | PAID → BOOKED | `finance.expense.book` |

`approve`/`reject` enregistrent `validatorId`+`validatedAt`. `mark-paid` exige qu'exactement un
compte (caisse ou banque) soit déjà renseigné sur la dépense (à la création ou via `PATCH` tant
qu'elle est en DRAFT).

## Format de permission `finance.<ressource>.<action>`

Divergence assumée du format plat de Phase 3-4 (`departments.create`) : Phase 4 n'avait pas
d'exemple contraire au brief, Finance en a un explicite (§30 donne littéralement
`finance.expense.approve`) — on le suit. Toutes les clés Phase 5 suivent ce format
(`finance.category.*`, `finance.cash-account.*`, `finance.bank-account.*`, `finance.revenue.*`,
`finance.expense.*`, `finance.budget.*`, `finance.summary.view`).

## `Budget`/`BudgetLine` — exécution calculée à la demande

`Budget` (hotelId, name, `periodType`, startDate, endDate, isActive — pas de workflow
DRAFT/ACTIVE/CLOSED, non demandé). `BudgetLine.type` (`FinancialCategoryType`) est **requis
indépendamment de `categoryId`** — résout l'ambiguïté revenue/expense quand une ligne cible
uniquement un département/activité/centre de coût sans catégorie précise (une ligne "toutes les
dépenses du département Restaurant" n'a pas besoin d'une catégorie unique). Prévu/Réalisé/Écart/
Taux **calculés à la demande** (`GET /budgets/:id/execution`), jamais stockés — agrège `Expense`
(statut PAID/BOOKED uniquement, argent réellement sorti) ou `Revenue` selon `line.type`, filtré
par les dimensions non-nulles de la ligne + la période du budget.

## Permissions et rôles seed

25 nouvelles clés `finance.*` (voir tableau ci-dessus + catégories/comptes/budget/summary).
`SUPER_ADMIN` : toutes. `HOTEL_ADMIN` : tout sauf `finance.expense.book` — comptabiliser relève
d'un contrôle financier au niveau organisation, même logique que l'exclusion `hotels.create` en
Phase 4 ; sert aussi de cas de test 403 sans inventer un 3ᵉ rôle démo.

## Scoping hôtel

Identique au mécanisme Phase 3-4 (`assertInScope` privé, dérivé du `requester`, jamais de
`hotelId` en query param). `FinancialCategory`/`CashAccount`/`BankAccount`/`Revenue`/`Expense`/
`Budget` ont un `hotelId` direct ; `BudgetLine`/`CashTransaction`/`BankTransaction` dérivent leur
hôtel via la relation parente.

## Dashboard financier minimal

`GET /finance/summary?month&year` (défaut mois courant) : total recettes/dépenses (PAID+BOOKED
uniquement), soldes caisse/banque agrégés. Un seul endpoint de lecture ; le reporting détaillé
(comparaisons multi-période, export) reste Phase 11.

## Vérification en base réelle

1. `npm run db:up` → `npm run db:migrate` → `npm run db:seed` (25 permissions finance ajoutées).
2. `npm run build:api` puis `node apps/api/dist/main.js`.
3. Login SUPER_ADMIN → catégories REVENUE/EXPENSE, caisse, compte bancaire créés.
4. Recette (350000, cashAccountId) → solde caisse 850000, `CashTransaction` IN créée.
5. Dépense (300000, DRAFT) → solde **inchangé** → submit → approve (solde inchangé) → mark-paid
   → solde 550000 (transaction créée **exactement** à cette étape) → book.
6. Budget annuel + ligne (EXPENSE, catégorie Électricité, planned 5000000) → exécution :
   actual=300000, variance=4700000, executionRate=6%.
7. Isolation : HOTEL_ADMIN ne voit que les catégories/comptes de son hôtel.
8. 403 : HOTEL_ADMIN → `POST /expenses/:id/book`. 401 : `GET /revenues` sans token.

## Périmètre exclu

Facturation/Paiements/Créances/Dettes (Phase 6, aucun `Invoice`/`Payment`) ; rapprochement
bancaire/import de relevés (hors périmètre) ; `Guest` sur Revenue (Phase 7) ; `Supplier` réel sur
Expense (Phase 9 — `vendorName` texte libre en attendant) ; alertes de dépassement budgétaire
(Phase 12, données déjà interrogeables) ; reporting/dashboard avancé (Phase 11) ; upload de
justificatifs réel (champ texte libre) ; clôture de caisse ; connexion frontend↔backend ;
conversion multi-devise (champ `currency` texte, pas de taux de change).
