# Phase 6 — Facturation + paiements

Décisions prises pour `Invoice`/`InvoiceLine`/`Payment`/`CreditNote`, en réutilisant directement
les mécanismes posés en Phase 5 (`CashAccount`/`BankAccount`, transactions postées atomiquement
au bon moment du cycle de vie, montants `Decimal`, totaux calculés à la demande). `apps/web`
reste inchangé. Aucun `Guest`/`Room`/`Reservation` réel — Phase 7.

## Client de la facture — champs texte, pas de FK

`clientName` (requis), `clientType` (`INDIVIDUAL`/`COMPANY`), `clientContact?`, `clientAddress?`
directement sur `Invoice` — même logique que `Expense.vendorName` en Phase 5. **Phase 7 pourra
ajouter `guestId String?`** (FK optionnelle) qui **complète** ces champs, ne les remplace pas —
une facture "entreprise" peut ne référencer aucun client individuel identifié.

## Dimensions analytiques identiques à `Revenue`

`hotelId`, `departmentId?`, `activityId?`, `costCenterId?`, `categoryId` (requis, type
`REVENUE`) — cohérence avec la hiérarchie §46 déjà posée pour Revenue/Expense/BudgetLine : une
facture est structurellement une recette en devenir.

## Invoice/Payment ↔ Revenue : coexistence, pas d'unification

`PaymentsService.create()` poste directement une `CashTransaction`/`BankTransaction` (IN) dans un
`$transaction` atomique — **aucune ligne `Revenue` créée**. `Revenue` a une sémantique de saisie
manuelle finale sans statut (§12) ; `Invoice`/`Payment` ont un cycle de vie différent — les
fusionner forcerait `Revenue` à porter un statut qu'elle n'a délibérément pas. Le pattern de
référence est `ExpensesService.markPaid()` : la transaction est créée au moment du paiement réel,
jamais avant.

**Conséquence corrigée dans cette phase** : `FinanceSummaryService.getSummary()` (Phase 5) ne
totalisait que `Revenue` — sous-comptait les recettes facturées. `totalRevenue` additionne
désormais `Payment.aggregate()` (filtré par date, via `invoice: hotelWhere`) à
`Revenue.aggregate()`. **Limite documentée** : les deux mécanismes de constatation de recette
coexistent sans réconciliation automatique au-delà de cette addition dans le dashboard —
réconciliation détaillée éventuelle en Phase 11 (Reporting).

## Statuts `Invoice` : recalculés déterministiquement, sauf `CANCELLED`

`InvoiceStatus {DRAFT ISSUED PARTIALLY_PAID PAID CANCELLED}`.

- `create()` → DRAFT (pas de numéro — une facture abandonnée ne consomme pas de séquence).
- `issue()` → ISSUED, assigne `invoiceNumber`+`issueDate`. Lignes immuables hors DRAFT (`update()`
  refuse toute modification si `status !== DRAFT`).
- Après chaque `Payment`/`CreditNote` (même `$transaction`), `InvoicesService.recalculateStatus()`
  recalcule `dueBalance = grandTotal − Σpayments − Σcreditnotes` et fixe
  PAID/PARTIALLY_PAID/ISSUED — **jamais de `PATCH` manuel vers ces 3 valeurs**.
- `CANCELLED` = action explicite (`POST /invoices/:id/cancel`), **impossible si des
  paiements/avoirs existent déjà** — une facture réglée en partie doit passer par un avoir, pas
  une annulation qui ferait disparaître un encaissement déjà comptabilisé en caisse/banque.

Totaux (`subtotal`/`discountTotal`/`taxTotal`/`grandTotal`/`amountPaid`/`amountCredited`/
`dueBalance`) **calculés à la demande** (`computeInvoiceTotals()`), jamais dénormalisés — même
principe que le solde `CashAccount`.

## `CreditNote` — entité simple, remboursement optionnel

`{invoiceId, amount, reason, date, cashAccountId?, bankAccountId?, createdById}`, pas de lignes
propres, pas de facture miroir. Remboursement optionnel : si un compte est renseigné (au plus un
des deux — pas de XOR strict, un avoir peut n'avoir aucun compte) → `CashTransaction`/
`BankTransaction` OUT postée (argent réellement rendu) ; sinon l'avoir réduit seulement le solde
dû sur papier (geste commercial/correction).

## Échéances : `dueDate` simple

Un seul champ, pas d'échéancier multi-versement — non détaillé ailleurs au brief, aurait été de
la sur-ingénierie non demandée.

## Créances/Dettes : vues calculées, pas de nouveaux modèles

- **Créances** = `GET /invoices/receivables` — route **statique déclarée avant** `GET
  /invoices/:id` dans le contrôleur (sinon Nest matcherait "receivables" comme un `:id`), filtre
  `status IN (ISSUED,PARTIALLY_PAID)` et `dueBalance>0` (calculé après fetch, pas en SQL).
- **Dettes** = **aucun code Phase 6** — `GET /expenses?status=APPROVED` (Phase 5) couvre déjà
  "dépenses approuvées non payées". **À ne pas recréer en Phase 9** (Fournisseurs).

## Numérotation assignée à l'émission

`invoiceNumber` reste `null` tant que `status = DRAFT`. À `issue()`, dans le `$transaction` :
`INV-{année}-{séquence 4 chiffres}` par hôtel (`count` des factures du même hôtel dont le numéro
commence par le préfixe, +1). **Limite de concurrence documentée** : pas de séquence Postgres
dédiée/verrou distribué cette phase — deux émissions strictement simultanées sur le même hôtel
pourraient viser le même numéro ; la contrainte `@@unique([hotelId, invoiceNumber])` fait échouer
la 2ᵉ proprement (erreur, pas de doublon silencieux). Acceptable au volume actuel, à durcir si
besoin dans une phase de sécurité/tests ultérieure.

## Taxes/remises au niveau ligne uniquement

`InvoiceLine{description, quantity, unitPrice, discountRate(0..1, défaut 0), taxRate(0..1,
défaut 0)}`. Formule par ligne : `quantity × unitPrice × (1−discountRate) × (1+taxRate)`, sommée
pour `grandTotal`. **Fractions, pas pourcentages entiers** (0.18 = 18%) — documenté dans les DTO
pour éviter une confusion d'unité côté consommateur API.

## Permissions — HOTEL_ADMIN reçoit tout

9 clés `finance.invoice.*`/`finance.payment.*`/`finance.credit-note.*` (nested, cohérent Phase
5). `SUPER_ADMIN` : toutes. `HOTEL_ADMIN` : **toutes les 9** — contrairement à
`finance.expense.book` (contrôle financier org-level, Phase 5), rien en Phase 6 n'a
d'équivalent : émettre/annuler une facture ou un avoir est une activité hôtelière quotidienne.
Le test 403 de vérification réutilise `finance.expense.book` (toujours valide, Phase 5 non
régressée).

## Vérification en base réelle

1. `npm run db:up` → `npm run db:migrate` → `npm run db:seed` (9 permissions ajoutées).
2. `npm run build:api` puis `node apps/api/dist/main.js`.
3. Login HOTEL_ADMIN → `POST /invoices` (2 lignes : une avec taxRate=0.18, une avec
   discountRate=0.1) → `grandTotal` correct.
4. `POST /invoices/:id/issue` → `invoiceNumber=INV-2026-0001`, statut ISSUED.
5. `POST /invoices/:id/payments` (partiel, cashAccountId) → PARTIALLY_PAID, solde caisse exact,
   `CashTransaction` avec `paymentId`.
6. 2ᵉ paiement soldant → PAID.
7. Sur une autre facture émise : `POST /invoices/:id/credit-notes` (bankAccountId) → solde banque
   diminué, statut recalculé.
8. `GET /invoices/receivables` → uniquement ISSUED/PARTIALLY_PAID avec solde dû > 0.
9. `GET /finance/summary` → `totalRevenue` inclut désormais les paiements de factures.
10. Isolation hôtel (comme Phases 3-5). 403 via `finance.expense.book`. 401 sans token.
11. `POST /invoices/:id/cancel` sur une facture PAID → 400 (paiements déjà enregistrés).

## Périmètre exclu

`Guest`/`Room`/`Reservation` réels (Phase 7, `guestId` complètera les champs texte) ;
rapprochement bancaire (hors périmètre) ; échéancier multi-versement ; fusion Invoice/Revenue
(limite documentée, réconciliation Phase 11) ; modèle Dettes dédié (`GET /expenses?status=
APPROVED` suffit, ne pas le recréer en Phase 9) ; connexion frontend↔backend.
