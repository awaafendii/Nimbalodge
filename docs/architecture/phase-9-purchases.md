# Phase 9 — Achats

Introduit `Supplier`/`PurchaseRequest`/`PurchaseOrder`+`PurchaseOrderLine`/`GoodsReceipt`+
`GoodsReceiptLine`, couvrant le workflow §23 du brief : *demande d'achat → validation → bon de
commande → réception → facture fournisseur → paiement*, affectable à un département.

Les deux dernières étapes ("facture fournisseur"+"paiement") ne sont **pas** de nouveaux modèles :
`Expense.supplierId`/`purchaseOrderId` (additifs) réutilisent le workflow DRAFT→PENDING→APPROVED→
PAID→BOOKED existant (Phase 5). C'était annoncé explicitement en Phase 5 ("Pas de FK Supplier réel
avant Phase 9 — texte libre en attendant", `Expense.vendorName`) et en Phase 6 ("modèle Dettes
dédié... à ne pas recréer en Phase 9").

## `Supplier` — catalogue, le vrai modèle annoncé en Phase 5

Même famille que `Guest`/`Department`/`FinancialCategory` : `hotelId` requis, `@@unique([hotelId,
name])`, pas de `createdById`, `isActive` pour désactivation permanente, pas de `DELETE` réel.
`Expense.vendorName` (texte libre) reste ; `Expense.supplierId` le **complète**, ne le remplace
pas — même principe qu'`Invoice.guestId` vs `clientName` (Phase 6/7).

## `PurchaseRequest` — "demande d'achat → validation" collapsées, comme `LeaveRequest`

Les deux premières étapes du brief sont collapsées en un seul modèle, exactement comme
`LeaveRequest` (Phase 8) : `create()` → `PENDING` directement (pas de `DRAFT` — une "demande" est
déjà l'objet soumis), `approve()`/`reject()`/`cancel()` partent tous du même statut source
`PENDING` via `transition()`, `update()` autorisé tant que `PENDING`.

`departmentId` **seul** (pas `activityId`/`costCenterId`) — le brief nomme explicitement "affectable
à un département" pour cette étape, rien de plus ; pas la triple dimension complète façon
Revenue/Expense/Invoice. Pas de `supplierId` : au stade de la demande, le fournisseur n'est pas
encore choisi (ça arrive à l'étape suivante) — même logique que `Reservation` sans dimensions
analytiques avant que le document financier ne les fixe (§46, Phase 7) : `PurchaseOrder` et
`PurchaseRequest` restent des engagements opérationnels, seul `Expense` (le document financier) en
Phase 9 porte les dimensions complètes.

## `PurchaseOrder`/`PurchaseOrderLine` — "bon de commande", même mécanique qu'`Invoice`

`supplierId` requis (contrairement à `PurchaseRequest`, ici le fournisseur est nécessairement
connu). `purchaseRequestId` optionnel — une commande directe sans demande préalable reste possible
(même logique qu'`Invoice.reservationId`, Phase 7) — mais **si renseigné, doit référencer une
`PurchaseRequest` `APPROVED`** (validé en service), ce qui fait respecter l'ordre "validation → bon
de commande" du brief sans en faire une contrainte DB.

Statuts recalculés déterministiquement à chaque réception (`recalculateStatus()`, même principe
qu'`InvoicesService`, Phase 6) : `PARTIALLY_RECEIVED`/`RECEIVED` selon la quantité reçue cumulée
par ligne vs la quantité commandée. `CANCELLED` reste une action explicite, **impossible dès
qu'une `GoodsReceipt` existe** (miroir de l'annulation `Invoice` bloquée si des paiements
existent). `orderNumber` (`PO-{année}-{séquence}`) assigné à `send()` (DRAFT → SENT), pas à la
création — même principe qu'`Invoice.invoiceNumber` assigné à `issue()`. Lignes immuables hors
DRAFT (validé en service). Pas de `discountRate`/`taxRate` sur `PurchaseOrderLine` (contrairement à
`InvoiceLine`) : un bon de commande interne n'a pas besoin de la mécanique de facturation client,
non détaillé au brief.

`orderTotal` et `receivedQuantity` par ligne **calculés à la demande**, jamais stockés — même
principe que le solde `CashAccount` (Phase 5) et les totaux `Invoice` (Phase 6).

## `GoodsReceipt`/`GoodsReceiptLine` — "réception", immuable comme `Payment`/`CreditNote`

Pas de `hotelId` propre (dérivé via `purchaseOrder`, même principe que `Payment`/`CreditNote`,
Phase 6). Pas de `PATCH`/`DELETE` : une réception constatée est un fait immuable — une correction
se ferait par une nouvelle réception, pas une modification rétroactive (réception négative hors
périmètre cette phase). **Contrôle de non-dépassement** : la quantité reçue cumulée par ligne (à
travers toutes les réceptions de la commande) ne peut jamais excéder la quantité commandée —
validé en service avant création, `400` sinon (vrai contrôle d'inventaire, pas de sur-réception
silencieuse).

## `Expense.supplierId`/`purchaseOrderId` — "facture fournisseur" + "paiement"

Deux FKs nullables additives. Une dépense créée avec ces champs renseignés constate la facture
reçue du fournisseur ; le workflow `Expense` existant (DRAFT→PENDING→APPROVED→PAID→BOOKED, `mark-
paid` postant `CashTransaction`/`BankTransaction` — Phase 5) couvre "paiement" sans code
supplémentaire. Aucune permission nouvelle : réutilise `finance.expense.*`. Vérifié en base réelle
(voir plus bas) : `supplierId` invalide → `400` ; workflow complet jusqu'à `mark-paid` → solde
caisse diminué exactement du montant, transaction créée à cette étape seulement (jamais avant, même
principe que Phase 5).

## Pas d'injection cross-module

`GoodsReceiptsService` est injecté avec `PurchaseOrdersService` (même module, réutilise
`recalculateStatus()` dans son propre `$transaction` — même pattern que `PaymentsService`→
`InvoicesService`, Phase 6). `ExpensesService` ne fait que lire `Supplier`/`PurchaseOrder` via
`this.prisma` directement pour validation (même principe que `validateReferences()` lisant
`FinancialCategory`/`Department`, Phase 5) — pas d'injection de `SuppliersService`/
`PurchaseOrdersService` dans `ExpensesModule`.

## Permissions — format plat, HOTEL_ADMIN reçoit tout

16 clés `resource.action` (non-finance, cohérent Phase 7-8) : `suppliers.*` (3), `purchase-
requests.*` (6), `purchase-orders.*` (5), `goods-receipts.*` (2). HOTEL_ADMIN reçoit les 16 —
gestion quotidienne hôtelière, aucun équivalent de contrôle org-level identifié (même raisonnement
que Phase 7/8, contrairement à `finance.expense.book`). Le test 403 de vérification réutilise
`finance.expense.book` (Phase 5, toujours valide).

## Vérification en base réelle

1. Migration (contournement Windows établi Phase 6 : `prisma migrate diff --from-url ... --to-
   schema-datamodel prisma/schema.prisma --script` → `prisma/migrations/<ts>_phase9_purchases/
   migration.sql` → `prisma migrate deploy`) → `prisma generate` → `npm run build:api` → `npm run
   db:seed` → `node apps/api/dist/main.js`.
2. `POST /suppliers` → 201 ; nom dupliqué même hôtel → 409.
3. `POST /purchase-requests` (PENDING, departmentId) → `POST /purchase-orders` en référençant cette
   demande PENDING → 400 ("doit être approuvée") → `approve` → APPROVED → `POST /purchase-orders`
   → 201 DRAFT, `orderTotal` correct.
4. `POST /purchase-orders/:id/send` → SENT, `orderNumber=PO-2026-0001`.
5. `POST /purchase-orders/:id/receipts` (6 sur 10 commandées) → PARTIALLY_RECEIVED,
   `receivedQuantity=6`.
6. Sur-réception (4 restantes, tente 10) → 400 ("dépasserait la quantité commandée").
7. `cancel` sur commande ayant une réception → 400.
8. `POST /purchase-orders/:id/receipts` (4 restantes) → RECEIVED, `receivedQuantity=10`.
9. `POST /expenses` avec `supplierId`+`purchaseOrderId` → 201 DRAFT ; `supplierId` invalide → 400.
10. `submit` → `approve` → `mark-paid` → solde caisse exactement diminué du montant, transaction
    créée à cette étape (jamais avant).
11. Isolation hôtel (comme Phases 3-8), 403 via `finance.expense.book`, 401 sans token.
12. `npm run typecheck` + `npm run build:api` (aucune régression `apps/web`/`nimbalodge-app`).

## Périmètre exclu

Réception négative / correction rétroactive d'une `GoodsReceipt` (une correction passerait par une
nouvelle réception, non implémenté) ; commande multi-fournisseurs (un `PurchaseOrder` = un
`Supplier`) ; workflow de rapprochement facture fournisseur ↔ bon de commande au-delà du lien
optionnel `Expense.purchaseOrderId` (pas de contrôle de montant facture vs commande, saisie
manuelle) ; génération automatique d'un `PurchaseOrder` depuis une `PurchaseRequest` approuvée (la
création reste une action manuelle référençant la demande) ; catalogue produits/stock (§24
Inventaire, Phase suivante — `PurchaseOrderLine.description` reste du texte libre, pas de FK vers
un `Product`) ; annulation d'une `PurchaseRequest` déjà `APPROVED` (comme `LeaveRequest`, `cancel`
reste `PENDING`-only) ; connexion frontend↔backend.
