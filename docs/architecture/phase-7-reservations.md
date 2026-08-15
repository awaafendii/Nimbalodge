# Phase 7 — Réservations + chambres + clients + séjours

Introduit `RoomType`/`Room`/`Guest`/`Reservation`, complète l'`Invoice` de la Phase 6 (engagement
déjà pris dans son commentaire de schéma) et couvre le workflow §19 du brief : *demande →
réservation → confirmation → check-in → séjour → check-out → facturation → paiement*
(facturation/paiement déjà couverts par `Invoice`/`Payment`, Phase 6 — Phase 7 ne les recrée pas,
elle les relie).

## `RoomType`/`Room`/`Guest` — catalogue par hôtel, jamais codé en dur

Même famille que `FinancialCategory`/`Department` : pas de `createdById`, `isActive` pour
désactivation permanente, pas de `DELETE` réel. `RoomType.baseRate` (§18 "tarifs") est le tarif de
référence courant, recopié — jamais relu en direct — dans `Reservation.agreedRate` au moment de la
réservation, même principe que `InvoiceLine.unitPrice` (Phase 6) : un changement de tarif ne doit
jamais faire dériver une réservation déjà prise.

## `Room` — aucun statut d'occupation stocké

"Disponible" se calcule en cherchant une `Reservation` active en chevauchement sur
`[checkInDate, checkOutDate)` (`RoomsService.hasOverlap()`/`available()`) — même principe que le
solde `CashAccount` (jamais dénormalisé). Le ménage/statuts de propreté (§25 Housekeeping) est
explicitement **Phase 10**, hors périmètre ici ; `isActive` sert uniquement à la désactivation
permanente (chambre décommissionnée), pas à un sous-statut maintenance temporaire.

## `Guest` — identité en texte libre

`documentType`/`documentNumber` en texte libre, pas d'enum — les types de pièces d'identité varient
par pays/contexte (même logique que les noms de Department/CostCenter). "Historique" (§20) =
relations `reservations[]`/`invoices[]` exploitées à la demande, jamais dupliquées. Scope hôtel
uniquement cette phase — pas d'unification inter-hôtels d'une même chaîne (limite documentée, pas
un redesign).

## `Reservation` — workflow PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT

Les deux termes du brief "demande"/"réservation" sont collapsés en un seul `PENDING` — mais pas par
simple synonymie (contrairement au collapse `SOUMIS`/`EN ATTENTE` de l'Expense, Phase 5) :
`PENDING` bloque déjà la chambre (`ReservationsService.create()` vérifie le chevauchement dès la
création), donc une "demande" qui ne bloquerait rien précède la frontière du système et n'a pas
besoin d'être persistée séparément.

- Chambre précise assignée dès la création (pas de réservation par TYPE puis allocation différée),
  une seule chambre par réservation — simplifications délibérées, non détaillées au brief.
- `agreedRate` = copie figée de `RoomType.baseRate` (ou tarif saisi explicitement) au moment de la
  réservation. Pas de `roomTypeId` stocké sur `Reservation` (dérivable via `room.roomType`, pure FK
  sans besoin de figer dans le temps).
- **Pas de dimensions analytiques** (`departmentId`/`activityId`/`costCenterId`) sur `Reservation`
  — c'est un engagement opérationnel, pas encore un fait financier. Comme pour
  Revenue/Expense/Invoice (§46), les dimensions sont toujours choisies au moment où le document
  financier est créé (ici la future `Invoice`), jamais héritées d'un enregistrement en amont.
- Anti-double-réservation sur `create()` **et** `update()` (update seulement si `PENDING`, miroir
  du DRAFT-only-edit d'`Invoice`/`Expense`) : `RoomsService.hasOverlap()` rejette toute
  `Reservation` `NOT IN (CANCELLED, NO_SHOW)` chevauchant `[checkInDate, checkOutDate)` sur la même
  chambre. Formule demi-ouverte : un check-in le jour même du check-out d'une autre réservation
  n'est pas un conflit.
- `cancel()` impossible après `CHECKED_IN` (miroir de l'annulation Invoice bloquée si paiements
  existants — un séjour en cours ou terminé ne s'annule pas), reste possible depuis
  `PENDING`/`CONFIRMED`.
- `confirm`/`check-in`/`check-out`/`no-show` via `transition()` privé (statut attendu unique, même
  pattern qu'`ExpensesService`).

## Intégration `Invoice` (Phase 6) — additive

`guestId String?` et `reservationId String?` (tous deux optionnels, `onDelete: SetNull`) ajoutés à
`Invoice` sans toucher `clientName`/`clientType`/`clientContact`/`clientAddress` (requis/optionnels
inchangés). `reservationId` volontairement non unique — une réservation pourrait en principe donner
lieu à plusieurs factures (acompte + solde), ce workflow lui-même restant hors périmètre.

## Permissions — format plat, HOTEL_ADMIN reçoit tout

17 clés `room-types.*`/`rooms.*`/`guests.*`/`reservations.*` au format plat `resource.action`
(domaine non-finance, cohérent Phase 3-4, contrairement au format imbriqué `finance.*` de
Phase 5-6). `SUPER_ADMIN` : toutes. `HOTEL_ADMIN` : **toutes les 17** — gestion quotidienne
hôtelière, aucun équivalent de contrôle org-level identifié (même raisonnement que la facturation
Phase 6). Le test 403 de vérification réutilise `finance.expense.book` (Phase 5, toujours valide).

## Vérification en base réelle

1. `npm run db:up` → migration (contournement Windows établi Phase 6 : `prisma migrate diff
   --from-url ... --to-schema-datamodel prisma/schema.prisma --script` → fichier →
   `prisma/migrations/<ts>_phase7_reservations/migration.sql` → `prisma migrate deploy`) → `prisma
   generate` → `npm run build:api` → `npm run db:seed`.
2. `node apps/api/dist/main.js`.
3. Login HOTEL_ADMIN → `POST /room-types` → `POST /rooms` ×2 → `POST /guests`.
4. `POST /reservations` → 201 PENDING, `agreedRate` défaulté depuis `RoomType.baseRate`.
5. `POST /reservations` chevauchant la même chambre → 409 Conflict.
6. `GET /rooms/available?checkIn=...&checkOut=...` → chambre occupée absente de la liste.
7. `confirm` → CONFIRMED → `check-in` → CHECKED_IN, `actualCheckInAt` posé.
8. `cancel` sur une réservation CHECKED_IN → 400.
9. `check-out` → CHECKED_OUT, `actualCheckOutAt` posé.
10. Nouvelle réservation PENDING → `cancel {reason}` → 200 CANCELLED.
11. Nouvelle réservation → `confirm` → `no-show` → 200 NO_SHOW.
12. `POST /invoices` avec `guestId`+`reservationId` renseignés → 201, présents dans la réponse.
13. Isolation hôtel, 403 via `finance.expense.book`, 401 sans token.
14. `npm run typecheck` + non-régression `apps/web`/`nimbalodge-app`.

## Périmètre exclu

Réservations multi-chambres ; calendrier de tarifs saisonniers/par date (`RoomType.baseRate` =
tarif courant unique, `Reservation.agreedRate` fige au moment de la réservation) ; ménage/statuts
de propreté (§25, Phase 10 — `Room.isActive` = désactivation permanente uniquement) ;
surbooking/liste d'attente ; programme de fidélité / fusion clients inter-hôtels (Guest scopé
hôtel, limite documentée) ; intégration channel-manager/OTA (`source` reste texte libre) ; workflow
acompte/solde dédié au-delà de l'`Invoice` générique déjà construite (`reservationId` non unique
laisse la porte ouverte, non implémenté cette phase) ; allocation différée type→chambre (chambre
assignée dès la création) ; confirmation automatique par acompte (`confirm()` = action manuelle) ;
connexion frontend↔backend.
