# Règles métier — Finance

Référence normative pour tout code touchant à l'argent dans NimbaLodge (Phases 5-6 :
`FinancialCategory`, `CashAccount`/`BankAccount`, `Revenue`, `Expense`, `Budget`, `Invoice`,
`Payment`, `CreditNote`). Consolidé depuis `docs/architecture/phase-5-finance.md` et
`phase-6-billing.md` à la demande de Master Prompt V2 §19. En cas de divergence future entre ce
document et le code, ce document fait foi — corriger le code, pas la règle.

## 1. Montants

- Tous les champs monétaires : `Decimal @db.Decimal(14, 2)` en base. Jamais `Float`/`Number` côté
  Prisma — évite les erreurs d'arrondi sur des sommations financières.
- DTO d'entrée : `number` JS avec `@IsNumber({maxDecimalPlaces:2}) @Min(0.01)`.
- Réponses API : les montants sont sérialisés en **chaînes** (`Decimal.toJSON()`), jamais en
  `number`. Le consommateur (frontend) doit parser explicitement — ne jamais faire d'arithmétique
  flottante sur un montant reçu de l'API sans repasser par une lib décimale.
- Aucun solde ni total n'est stocké dénormalisé : `CashAccount`/`BankAccount.balance`,
  `Invoice.{subtotal,discountTotal,taxTotal,grandTotal,amountPaid,amountCredited,dueBalance}`,
  `Budget` exécution — tous **calculés à la demande**. Évite toute désynchronisation entre un
  cache et les transactions réelles qui le sous-tendent.

## 2. Distinction Revenue / Invoice+Payment (règle centrale)

`Revenue` et `Invoice`/`Payment` sont **deux mécanismes de constatation de recette qui coexistent
sans fusion et sans réconciliation automatique au-delà de leur addition dans le dashboard.**

| | `Revenue` | `Invoice` → `Payment` |
|---|---|---|
| Usage | Saisie manuelle finale d'une recette déjà encaissée | Cycle de facturation avec créance (montant dû avant encaissement) |
| Statut | Aucun (un seul état atteignable — pas de sur-ingénierie) | `DRAFT → ISSUED → PARTIALLY_PAID/PAID`, ou `CANCELLED` |
| Écriture caisse/banque | Créée **atomiquement à la création** de la `Revenue` | Créée **au moment de chaque `Payment`**, jamais à l'émission de la facture |
| Client | — | `clientName`/`clientType`/`clientContact`/`clientAddress` (texte), `guestId?` optionnel qui complète, ne remplace jamais |

**Ne jamais** créer une ligne `Revenue` à partir d'un `Payment`, ni l'inverse. Si un futur module
a besoin d'un total "recette", il doit agréger les deux sources explicitement (voir §6) plutôt que
supposer une source unique.

**Règle générale dérivée** : une transaction de caisse/banque (`CashTransaction`/
`BankTransaction`) n'est **jamais créée avant que l'argent n'ait réellement bougé**. C'est le
principe directeur pour toute nouvelle fonctionnalité qui touche à l'argent :

- `Revenue` : à la création (l'action de saisie EST l'encaissement).
- `Expense` : à `mark-paid`, jamais à DRAFT/PENDING/APPROVED.
- `Payment` : à sa création.
- `CreditNote` : à sa création, seulement si un compte de remboursement est renseigné.

## 3. Workflow `Expense`

`ExpenseStatus {DRAFT PENDING APPROVED REJECTED PAID BOOKED}`. Transitions via endpoints dédiés
uniquement — **jamais de `PATCH` générique de statut** (effets de bord et permissions différents
par transition) :

| Endpoint | Transition | Permission |
|---|---|---|
| `POST /expenses` | — → DRAFT | `finance.expense.create` |
| `PATCH /expenses/:id` | DRAFT seulement | `finance.expense.update` |
| `POST /expenses/:id/submit` | DRAFT → PENDING | `finance.expense.submit` |
| `POST /expenses/:id/approve` | PENDING → APPROVED | `finance.expense.approve` |
| `POST /expenses/:id/reject` | PENDING → REJECTED | `finance.expense.approve` |
| `POST /expenses/:id/mark-paid` | APPROVED → PAID | `finance.expense.pay` |
| `POST /expenses/:id/book` | PAID → BOOKED | `finance.expense.book` |

`mark-paid` exige qu'exactement un compte (caisse **ou** banque, jamais les deux) soit déjà
renseigné sur la dépense. `finance.expense.book` est réservé à `SUPER_ADMIN` (contrôle financier
niveau organisation) — `HOTEL_ADMIN` a toutes les autres permissions finance.

## 4. Workflow `Invoice`

`InvoiceStatus {DRAFT ISSUED PARTIALLY_PAID PAID CANCELLED}`, recalculé **déterministiquement**
après chaque `Payment`/`CreditNote`, sauf `CANCELLED` qui est une action explicite.

- `create()` → DRAFT, pas de `invoiceNumber` (une facture abandonnée ne consomme pas de séquence).
- `issue()` → ISSUED, assigne `invoiceNumber` (`INV-{année}-{séquence 4 chiffres}` par hôtel) +
  `issueDate`. Lignes immuables hors DRAFT.
- Après chaque `Payment`/`CreditNote` (même `$transaction`) : `recalculateStatus()` recalcule
  `dueBalance = grandTotal − Σpayments − Σcreditnotes` et fixe PAID/PARTIALLY_PAID/ISSUED.
  **Jamais de `PATCH` manuel** vers ces 3 valeurs.
- `cancel()` : **impossible si des paiements/avoirs existent déjà** — une facture réglée en
  partie doit passer par un `CreditNote`, pas une annulation qui ferait disparaître un
  encaissement déjà comptabilisé en caisse/banque.
- Lignes : `{description, quantity, unitPrice, discountRate(0..1, défaut 0), taxRate(0..1, défaut
  0)}`. Formule : `quantity × unitPrice × (1−discountRate) × (1+taxRate)`. **Fractions, pas
  pourcentages entiers** (0.18 = 18%).
- Concurrence de numérotation : pas de séquence Postgres dédiée/verrou distribué — deux émissions
  strictement simultanées pourraient viser le même numéro ; `@@unique([hotelId, invoiceNumber])`
  fait échouer la 2ᵉ proprement (erreur explicite, jamais de doublon silencieux). Acceptable au
  volume actuel ; à durcir si un incident réel l'exige.

## 5. `CreditNote`

`{invoiceId, amount, reason, date, cashAccountId?, bankAccountId?, createdById}`. Pas de lignes
propres, pas de facture miroir. Remboursement **optionnel** : au plus un des deux comptes (pas de
XOR strict — un avoir peut n'avoir aucun compte) :
- Compte renseigné → `CashTransaction`/`BankTransaction` OUT postée (argent réellement rendu).
- Aucun compte → l'avoir réduit seulement le solde dû sur papier (geste commercial/correction),
  aucune écriture de caisse/banque.

## 6. Dashboard financier (`GET /finance/summary`)

`totalRevenue` = `Revenue.aggregate()` **+** `Payment.aggregate()` (filtré par date, via
`invoice: hotelWhere`). Toute nouvelle route de reporting qui calcule un total de recettes doit
suivre ce même principe d'addition explicite des deux sources — ne jamais lire une seule des deux
tables en supposant qu'elle est exhaustive.

`totalExpense` = `Expense` avec statut `PAID`/`BOOKED` uniquement (argent réellement sorti — DRAFT/
PENDING/APPROVED/REJECTED exclus).

## 7. `Budget` / `BudgetLine`

Pas de workflow DRAFT/ACTIVE/CLOSED — `isActive` booléen suffit, non spécifié autrement.
`BudgetLine.type` (`FinancialCategoryType`) est **requis indépendamment de `categoryId`** — permet
une ligne ciblant uniquement un département/activité/centre de coût sans catégorie précise.
Prévu/Réalisé/Écart/Taux **calculés à la demande** (`GET /budgets/:id/execution`), jamais
stockés — agrège `Expense` (statut PAID/BOOKED uniquement) ou `Revenue` selon `line.type`, filtré
par les dimensions non-nulles de la ligne + la période du budget.

## 8. Créances / Dettes — vues calculées, pas de nouveaux modèles

- **Créances** = `GET /invoices/receivables` (route statique déclarée avant `GET /invoices/:id`
  dans le contrôleur — sinon Nest matcherait "receivables" comme un `:id`). Filtre `status IN
  (ISSUED, PARTIALLY_PAID)` et `dueBalance > 0` (calculé après fetch).
- **Dettes** = `GET /expenses?status=APPROVED` (dépenses approuvées non encore payées). **Ne pas
  créer de modèle `Debt` dédié** — cette vue calculée suffit tant qu'aucun besoin fonctionnel
  supplémentaire n'est explicitement documenté.

## 9. `FinancialCategory` et `PaymentMethod`

- `FinancialCategory` : un seul modèle, `type: REVENUE|EXPENSE`, `hotelId` requis (configurable
  **par hôtel**, jamais de template org-wide imposé — cohérent avec la directive "no imposed
  config"). `type` non modifiable après création (éviterait de reclasser rétroactivement le sens
  des `Revenue`/`Expense` déjà rattachées).
- `PaymentMethod` = enum (`CASH BANK_TRANSFER MOBILE_MONEY CARD CHECK OTHER`), pas de table — la
  vraie destination des fonds est déjà modélisée via `cashAccountId`/`bankAccountId`.

## 10. Scoping multi-tenant

Toute requête finance passe par [[assert-in-scope-refactor]] (`assertInScope()`,
`apps/api/src/common/utils/assert-in-scope.ts`) — jamais de `hotelId` accepté depuis un query
param ou un body pour déterminer le périmètre, toujours dérivé du `requester` authentifié.
`FinancialCategory`/`CashAccount`/`BankAccount`/`Revenue`/`Expense`/`Budget`/`Invoice` ont un
`hotelId` direct ; les entités enfants (`BudgetLine`, `CashTransaction`, `BankTransaction`,
`InvoiceLine`, `Payment`, `CreditNote`) dérivent leur hôtel via la relation parente.

## 11. Permissions

Format `finance.<ressource>.<action>` (divergent du format plat `departments.create` de Phase 3-4,
assumé — Finance a un exemple explicite du brief dans ce format). `SUPER_ADMIN` : toutes les
permissions finance. `HOTEL_ADMIN` : toutes sauf `finance.expense.book` (comptabilisation =
contrôle financier niveau organisation).

## 12. Hors périmètre (documenté, ne pas réinventer silencieusement)

- Rapprochement bancaire / import de relevés.
- Clôture de caisse (solde théorique/réel/écart).
- Échéancier multi-versement sur `Invoice` (un seul `dueDate`).
- Conversion multi-devise (`currency` est un champ texte libre, aucun taux de change).
- Upload de justificatifs réel (champ texte libre pour l'instant).
- Modèle `Debt` dédié — voir §8.
- Réconciliation automatique Revenue ↔ Invoice/Payment au-delà de l'addition du dashboard (§6) —
  réconciliation détaillée éventuelle en reporting avancé, seulement si explicitement demandée.
