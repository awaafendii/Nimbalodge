# Phase 11 — Reporting

Introduit `ReportsModule` : §54 du brief, "moteur de rapports paramétrable (export PDF/Excel/CSV,
filtres période/département/activité/catégorie)". Première phase sans nouveau modèle Prisma —
lecture pure sur les données déjà posées (Revenue/Expense/Payment/Invoice, Phases 5-6), pas de
migration.

## Un seul rapport cette phase, mais un moteur d'export réutilisable

Le brief §54 est générique ("moteur paramétrable"), sans nommer de rapports précis — contrairement
à chaque phase précédente qui listait des entités/workflows concrets. Plutôt que d'inventer
plusieurs types de rapports non nommés au brief (occupation, RH, achats...), cette phase construit
**un** rapport (`GET /reports/financial`) qui reprend exactement les quatre filtres nommés
littéralement par le brief (période, département, activité, catégorie — les dimensions déjà
posées sur `Revenue`/`Expense`/`Invoice` depuis la Phase 5, §46), plus un `groupBy` (mois/catégorie/
département/activité) qui en fait un vrai "moteur" (comparaisons multi-période citées Phase 5,
réconciliation Invoice/Revenue citée Phase 6) plutôt qu'un tableau de bord figé comme
`GET /finance/summary` (Phase 5, mois/année fixe).

`report-export.util.ts` (CSV/Excel/PDF) est délibérément **générique** (`ReportTable` = titre +
colonnes + lignes, indépendant du domaine financier) — conçu pour être réutilisé tel quel par un
futur 2ᵉ type de rapport (occupation, RH...) sans dupliquer la logique d'export, même si aucun
autre rapport n'est construit cette phase.

## `totalRevenue` — même doctrine que `FinanceSummaryService` (Phase 5/6)

`Revenue.amount` + `Payment.amount` (les paiements de factures sont une 2ᵉ source de recette
distincte, Phase 6, décision 3 — le rapport ne les recompte pas en double, mais ne les oublie pas
non plus). Les dimensions de `Payment` (département/activité/catégorie) se lisent sur son
`Invoice` liée, pas sur `Payment` lui-même (qui n'en porte pas). `Expense` filtré `PAID`/`BOOKED`
uniquement (même règle que le dashboard Phase 5 — un brouillon ou une dépense approuvée non payée
n'a pas encore bougé d'argent réel). Vérifié en base réelle : une `Expense` `DRAFT` de 999999
n'apparaît dans aucun groupe.

## Groupement — calculé en JS, pas en SQL

`groupBy=month/category/department/activity` : les lignes `Revenue`/`Expense`/`Payment` filtrées
par période+dimensions sont chargées puis regroupées par réduction JS (`Map<clé, {revenus,
dépenses}>`), pas via `prisma.groupBy` — parce que `Payment` n'a pas de `categoryId`/`departmentId`/
`activityId` propre (dérivés de sa relation `invoice`), ce qu'un `groupBy` SQL ne peut pas exprimer
directement sans jointure manuelle. Même principe que `computeInvoiceTotals()`/`PurchaseOrder.
receivedQuantity` : agrégation en mémoire, acceptable au volume actuel (comme documenté dans ces
phases). Une ligne sans la dimension demandée (ex. `departmentId` null en `groupBy=department`) est
regroupée sous `"Non affecté"`, pas silencieusement ignorée.

## Export — `res.send()` direct, pas `StreamableFile`

`format=json` (défaut) : `return` normal, Nest sérialise. `format=csv/xlsx/pdf` : `@Res({
passthrough: true })` + `res.set(headers)` + `res.send(buffer)` directement — Nest ne retente pas
d'envoyer sa propre sérialisation une fois `res.send()` déjà appelé (comportement standard du mode
`passthrough`, documenté içi car c'est le premier endpoint du projet à sortir du flux JSON par
défaut). Nouvelles dépendances : `exceljs` (Excel réel, pas de génération XML manuelle) et `pdfkit`
(PDF réel, rendu texte tabulaire simple — pas de mise en page sophistiquée, non demandée au brief).
`csv` généré à la main (pas de dépendance : format trivial, échappement virgule/guillemet/retour à
la ligne géré directement).

## Permissions

Une seule clé, `reports.financial.view` (format `finance.*`-adjacent car le rapport reste
financier). HOTEL_ADMIN la reçoit — même raisonnement que `finance.summary.view` (Phase 5) : lecture
pure, aucun contrôle org-level à exclure.

## Vérification en base réelle

1. `npm run build:api` (voir note opératoire `tsconfig.tsbuildinfo`, Phase 10) → `npm run db:seed`
   (1 permission ajoutée, pas de migration) → `node apps/api/dist/main.js`.
2. Revenue 500000 + Expense 200000 (PAID) + Expense 999999 (DRAFT, non payée) + Invoice émise
   avec paiement 150000, tous rattachés au même département.
3. `GET /reports/financial?groupBy=department&departmentId=...` → `totalRevenue=650000` (500000 +
   150000 du paiement), `totalExpense=200000` (la DRAFT à 999999 absente).
4. `dateFrom >= dateTo` → `400`. `departmentId` invalide → `400`.
5. `format=csv` → contenu exact avec ligne `TOTAL`, `Content-Type: text/csv`.
6. `format=xlsx` → signature ZIP valide (`PK\x03\x04`), `Content-Type` Excel correct.
7. `format=pdf` → signature `%PDF-1.3` valide, `Content-Type: application/pdf`.
8. Isolation hôtel (comme Phases 3-10), 401 sans token.
9. `npm run typecheck` (aucune régression `apps/web`/`nimbalodge-app`).

## Périmètre exclu

Rapports non financiers (occupation, RH, achats — non nommés explicitement au brief §54, le moteur
d'export reste réutilisable pour eux plus tard) ; mise en page PDF avancée (logos, styles, sauts de
section — rendu texte tabulaire simple) ; rapports enregistrés/programmés (génération à la demande
uniquement, pas de scheduler) ; pagination sur `GET /reports/financial` (JSON complet à chaque
appel, volume actuel acceptable) ; connexion frontend↔backend.
