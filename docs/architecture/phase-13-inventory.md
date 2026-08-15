# Phase 13 — Inventaire

Introduit `Product`/`Warehouse` (catalogues) et `StockMovement` (§24 du brief : "produits,
entrepôts, mouvements (entrée/sortie/transfert/ajustement/consommation/perte), seuils minimum,
alertes — lié aux départements"). Dernière feature frontend nommée sans backend — le stub
`apps/web/src/features/inventory/README.md` indiquait "Phase 9" mais c'était une estimation figée
depuis la Phase 1 : la Phase 9 réellement construite n'a couvert que les Achats (voir
`docs/architecture/phase-9-purchases.md`, périmètre exclu : "catalogue produits/stock — Phase
suivante").

## `Product`/`Warehouse` — catalogues, `Product` garde l'unicité du nom (contrairement à `Asset`)

Même famille que `Supplier`/`Department` : `@@unique([hotelId, name])`, pas de `createdById`,
`isActive` pour désactivation permanente. Contrairement à `Asset` (Phase 10, délibérément SANS
contrainte d'unicité — plusieurs actifs physiques peuvent partager un nom générique), un `Product`
est une entrée catalogue censée être unique (comme `Supplier`) : la déviation d'`Asset` reste
l'exception documentée, pas la nouvelle règle.

`Warehouse.departmentId` optionnel — "lié aux départements" (§24) satisfait à ce niveau (même
principe que `CostCenter.departmentId`, Phase 4) ; `StockMovement` lui-même **ne porte aucune
dimension analytique propre** (pas de `departmentId`/`activityId`/`costCenterId`) — c'est un
engagement opérationnel, pas un fait financier (même principe que `Reservation`/`PurchaseOrder`,
Phases 7/9). Le rattachement département se lit via l'entrepôt, jamais dupliqué sur le mouvement.

## `StockMovement` — un seul modèle pour 6 types, quantité jamais dénormalisée

Comme `Revenue`/`Expense` partagent un seul modèle via `type` plutôt que 6 tables. `OUT`/
`CONSUMPTION`/`LOSS` ont le **même effet mécanique** (diminuent le stock du même entrepôt) mais
restent des valeurs `type` distinctes — la différence est catégorielle (reporting : sortie générale
vs consommation vs casse), pas structurelle ; non davantage précisé au brief, donc pas
sur-conçu au-delà de la distinction nominale demandée.

`TRANSFER` porte `toWarehouseId` (uniquement pour ce type) plutôt qu'un second modèle
"TransferLine" — un seul enregistrement suffit, diminue `warehouseId` (source) et augmente
`toWarehouseId` (destination) au calcul. `ADJUSTMENT` est le seul type où `quantity` est **signée**
(une correction d'inventaire physique va dans les deux sens) — validé en service (non-nullité),
pas en contrainte DB, même principe que le XOR caisse/banque d'`Expense` (Phase 5).

**Quantité en stock jamais dénormalisée** sur `Product`/`Warehouse` : `StockMovementsService.
computeOnHand()` recalcule à la demande en sommant tous les mouvements du produit par entrepôt —
même doctrine que le solde `CashAccount` (Phase 5), la quantité reçue `PurchaseOrderLine`
(Phase 9) et le statut ménage `Room` (Phase 10). Vérifié en base réelle : IN 50 → OUT 10 → TRANSFER
15 (source→dest) → ADJUSTMENT -5 → `GET /products/:id/stock` recalcule exactement 20/15 (total 35),
jamais un compteur stocké qui aurait pu diverger.

## Contrôle d'inventaire réel — un entrepôt ne descend jamais sous zéro

Avant toute création de mouvement qui diminue un entrepôt (`OUT`/`CONSUMPTION`/`LOSS`/le côté
source d'un `TRANSFER`/un `ADJUSTMENT` négatif), `assertSufficientStock()` recalcule le solde
courant et rejette (`400`) si la quantité demandée dépasserait le disponible — même principe que le
contrôle de non-dépassement de `GoodsReceipt` (Phase 9). Vérifié en base réelle : `OUT` de 60 sur un
stock de 50 → `400` ("Stock insuffisant... disponible : 50, demandé : 60").

## `goodsReceiptId` — lien optionnel, création manuelle uniquement

Un mouvement `IN` peut référencer (`goodsReceiptId`) la réception fournisseur (Phase 9) dont il
constate l'entrée en stock — mais **création manuelle uniquement** : `GoodsReceiptsService.
create()` (Phase 9) n'est PAS modifié pour déclencher automatiquement un mouvement de stock, même
discipline que la Phase 10 n'ayant pas modifié `ReservationsService.checkOut()` pour créer une
`HousekeepingTask` automatiquement — éviter de rouvrir le fichier d'une phase déjà close pour une
automatisation non explicitement demandée au brief.

## Endpoints de création — 3, pas 6

`POST /stock-movements` (IN/OUT/CONSUMPTION/LOSS, `type` dans le corps — structure identique,
quatre valeurs), `POST /stock-movements/transfer` (deux entrepôts), `POST /stock-movements/
adjustment` (quantité signée) — pas 6 endpoints dédiés un par type : 4 des 6 types partagent
exactement la même forme de DTO, dupliquer aurait été de la sur-ingénierie pour une distinction
purement catégorielle (voir plus haut). Pas de `PATCH`/`DELETE` : un mouvement constaté est un fait
immuable (même statut que `Payment`/`CreditNote`/`GoodsReceipt`).

## "Alertes" (§24) — réutilise telle quelle l'infrastructure de la Phase 12

`ProductsService.checkLowStock()` est le second consommateur de `NotificationsService.
notifyUsersWithPermission()` (le premier étant `BudgetsService.checkOverspendAlerts()`, Phase 12) —
aucune modification à `NotificationsService` n'a été nécessaire, la fonction générique a fonctionné
sans changement. Même déclenchement à la demande (pas de scheduler), même déduplication par
`relatedType`/`relatedId` (`"product"`/`productId`), même fan-out aux détenteurs d'une permission
(`products.view`) de l'hôtel + les org-wide. Vérifié en base réelle : franchissement du seuil
(stock total 19 < seuil 20) → 1er appel `notificationsCreated=2` (SUPER_ADMIN + HOTEL_ADMIN), 2ᵉ
appel immédiat → `0` (déduplication).

## Permissions

11 clés `resource.action` (format plat, cohérent Phase 7-10) : `warehouses.*` (3), `products.*` (4,
dont `products.check-low-stock`), `stock-movements.*` (4 : `view`/`create`/`transfer`/
`adjustment`). HOTEL_ADMIN reçoit tout — même raisonnement que toutes les phases opérationnelles
précédentes, aucun contrôle org-level identifié pour l'inventaire.

## Vérification en base réelle

1. Migration (contournement Windows établi Phase 6) → `prisma generate` → `npm run build:api`
   (voir note `tsconfig.tsbuildinfo`, Phase 10) → `npm run db:seed` → `node apps/api/dist/main.js`.
2. 2 entrepôts + 1 produit (`minThreshold=20`) ; nom d'entrepôt dupliqué → `409`.
3. `IN` 50 → `OUT` 60 (dépasse le disponible) → `400` ; `OUT` 10 valide.
4. `TRANSFER` 15 (WH1→WH2) → `GET /products/:id/stock` : WH1=25, WH2=15, total=40 (exact).
5. `ADJUSTMENT` -5 sur WH1 → total 35 ; `ADJUSTMENT` quantité=0 → `400`.
6. `CONSUMPTION` 16 supplémentaires → total 19, sous le seuil 20.
7. `POST /products/check-low-stock` → `lowStockCount=1`, `notificationsCreated=2` ; rappel
   immédiat → `0` (déduplication) ; notification visible via `GET /notifications`.
8. `TRANSFER` avec entrepôt source = destination → `400`.
9. `401` sans token sur `/products`, `/warehouses`, `/stock-movements`.
10. `npm run typecheck` (aucune régression `apps/web`/`nimbalodge-app`).

## Périmètre exclu

Seuils par entrepôt (un seul `minThreshold` global par produit, pas par paire produit/entrepôt) ;
déclenchement automatique d'un mouvement `IN` depuis `GoodsReceiptsService.create()` (Phase 9,
lien `goodsReceiptId` manuel uniquement) ; réservation de stock pour une commande en cours
(pas de statut "réservé" distinct du disponible) ; valorisation du stock (coût unitaire moyen
pondéré, FIFO/LIFO — non détaillé au brief, `StockMovement` ne porte aucun champ de coût) ;
correction/annulation d'un mouvement déjà créé (fait immuable, une correction passe par un nouveau
mouvement `ADJUSTMENT`) ; connexion frontend↔backend.
