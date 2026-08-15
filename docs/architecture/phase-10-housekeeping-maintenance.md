# Phase 10 — Ménage + Maintenance

Introduit `HousekeepingTask` (§25) et `Asset`/`MaintenanceRequest`/`MaintenanceIntervention` (§26).
Deux domaines opérationnels distincts autour des mêmes ressources physiques posées en Phase 7
(`Room`) — bundlés dans une seule phase (comme annoncé explicitement dans
`docs/architecture/phase-7-reservations.md` : "ménage/statuts de propreté §25 Housekeeping est
explicitement Phase 10"), chacun avec ses propres modules.

## `HousekeepingTask` — statut jamais dénormalisé sur `Room`

§25 : "dashboard chambres à nettoyer/propres/inspectées, workflow check-out → nettoyage →
inspection → disponible". La tentation naturelle serait un champ `Room.housekeepingStatus` — rejeté
pour la même raison que l'absence de statut d'occupation sur `Room` (Phase 7) : le statut "courant"
d'une chambre se lit en cherchant sa `HousekeepingTask` la plus récente
(`HousekeepingTasksService.dashboard()`), jamais stocké sur `Room`. Une chambre sans tâche, ou dont
la plus récente est `INSPECTED`, est reportée `AVAILABLE` — c'est la valeur calculée qui représente
"disponible", pas un statut persistant.

Pas de `PATCH`/mise à jour (même minimalisme qu'`Attendance`, Phase 8) : `create()` = constat "à
nettoyer" (`TO_CLEAN`), `clean()` et `inspect()` sont les deux seules transitions, chacune
enregistre qui/quand (`cleanedById`/`cleanedAt`, `inspectedById`/`inspectedAt` — même principe que
`validatorId`/`validatedAt` sur `Expense`). Vérifié en base réelle : `inspect()` avant `clean()` →
`400`. Pas de réouverture après `INSPECTED` (une inspection ratée relancerait un nouveau
`HousekeepingTask`, non implémenté — limite documentée).

**Déclenchement automatique au check-out** (`ReservationsService.checkOut()`, Phase 7) **hors
périmètre** : la création reste manuelle cette phase — évite de rouvrir un fichier d'une phase déjà
close pour une automatisation non demandée explicitement au brief. "Utilisable depuis mobile" (§25)
est une préoccupation frontend, sans conséquence sur la forme de l'API REST déjà mobile-agnostique.

## `Asset` — catalogue, déviation assumée sur l'unicité du nom

Catalogue par hôtel comme `Supplier`/`Department`, `roomId` optionnel (un actif peut être général à
l'hôtel — groupe électrogène, ascenseur — pas systématiquement rattaché à une chambre). **Pas de
`@@unique([hotelId, name])`** (contrairement à tous les autres catalogues du projet) : plusieurs
actifs peuvent légitimement partager un nom générique (plusieurs "Climatiseur Split" distincts par
chambre/`serialNumber`) — le nom ne sert pas d'identifiant humain unique ici. Vérifié en base
réelle : deux actifs de même nom → `201` les deux fois.

## `MaintenanceRequest` — même forme que `PurchaseRequest` (Phase 9)

`create()` → `PENDING` directement, `approve()`/`reject()`/`cancel()` partent tous de `PENDING` via
`transition()`, `update()` autorisé tant que `PENDING`. `assetId`/`roomId` tous deux optionnels et
indépendants (pas de XOR) : un problème peut concerner un actif catalogué, un simple emplacement,
les deux, ou ni l'un ni l'autre. Pas de statut `RESOLVED` : la clôture réelle est représentée par le
statut `COMPLETED` de l'intervention liée, pas dupliquée ici (même principe que Phase 6 : pas de
modèle Dettes séparé quand `Expense.status` suffit).

## `MaintenanceIntervention` — `PurchaseOrder` simplifié, sans lignes

Même mécanique de statuts qu'un bon de commande (Phase 9) : `SCHEDULED → IN_PROGRESS → COMPLETED`,
`CANCELLED` en sortie alternative — mais **sans lignes** (une intervention est une unité de travail,
pas un document multi-articles, non détaillé au brief). `maintenanceRequestId` optionnel — si
renseigné, doit référencer une `MaintenanceRequest` `APPROVED` (même principe que
`PurchaseOrder.purchaseRequestId`, vérifié en base réelle : intervention créée sur une demande
`PENDING` → `400`). `cancel()` pas via `transition()` (statut unique attendu) : `SCHEDULED` et
`IN_PROGRESS` sont tous deux annulables, `COMPLETED` ne l'est plus — même principe que
`Reservation.cancel()` (Phase 7).

**"Coûts" (§26)** : simple champ `cost` descriptif, **pas** de FK `Expense` additive (contrairement
à `Payslip.expenseId`/`Expense.purchaseOrderId`, Phases 8/9) — une intervention n'implique pas
systématiquement une sortie de caisse réelle (travail interne sans achat), et le cas où elle en
implique une (pièces/prestataire externe) passe déjà par le circuit `Supplier`/`PurchaseOrder`/
`Expense` existant (Phase 9) : dupliquer le lien ici serait redondant.

**"Historique" (§26)** : pas de nouveau modèle — `GET /maintenance-interventions?assetId=`/`roomId=`
(liste filtrée) suffit, même principe que les Créances/Dettes en vues calculées (Phase 6). Vérifié
en base réelle.

## Pas d'injection cross-module

Les quatre nouveaux modules ne font que lire `Room`/`Asset`/`MaintenanceRequest` directement via
`this.prisma` pour validation (même principe que `validateReferences()` partout ailleurs) — pas
d'injection de `RoomsService` dans les modules Phase 10.

## Permissions — format plat, HOTEL_ADMIN reçoit tout

19 clés `resource.action` (non-finance, cohérent Phase 7-9) : `housekeeping-tasks.*` (4, pas
d'`update` — même minimalisme qu'`attendance.*`), `assets.*` (3), `maintenance-requests.*` (6),
`maintenance-interventions.*` (6). HOTEL_ADMIN reçoit les 19 — même raisonnement que Phase 7-9,
aucun équivalent de contrôle org-level identifié. Le test 403 de vérification réutilise
`finance.expense.book` (Phase 5, toujours valide).

## Vérification en base réelle

1. Migration (contournement Windows établi Phase 6 : `prisma migrate diff --from-url ... --to-
   schema-datamodel prisma/schema.prisma --script` → `prisma/migrations/<ts>_phase10_housekeeping_
   maintenance/migration.sql` → `prisma migrate deploy`) → `prisma generate` → `npm run build:api`
   → `npm run db:seed` → `node apps/api/dist/main.js`.
2. `GET /housekeeping-tasks/dashboard` sans tâche → toutes les chambres `AVAILABLE`.
3. `POST /housekeeping-tasks` → `TO_CLEAN` ; `inspect` avant `clean` → `400`.
4. `clean` → `CLEANED` (dashboard reflète) → `inspect` → `INSPECTED` (dashboard revient à
   `AVAILABLE`, `taskId` renseigné).
5. `POST /assets` ×2 même nom → `201` les deux fois (pas de conflit).
6. `POST /maintenance-requests` → `PENDING` → intervention référençant cette demande → `400` →
   `approve` → `APPROVED` → intervention → `201` `SCHEDULED`.
7. `complete` avant `start` → `400` ; `start` → `IN_PROGRESS` → `complete` → `COMPLETED`,
   `completedDate`/`performedById` renseignés.
8. `cancel` sur intervention `COMPLETED` → `400`.
9. `GET /maintenance-interventions?assetId=...` → liste filtrée correcte.
10. Isolation hôtel (comme Phases 3-9), 403 via `finance.expense.book`, 401 sans token.
11. `npm run typecheck` + `npm run build:api` (aucune régression `apps/web`/`nimbalodge-app`).

## Note opératoire — `deleteOutDir` + `incremental` de `apps/api/tsconfig.json`

Récurrent depuis Phase 9 : `nest build` peut ne produire aucun `dist/` (silencieusement, exit 0) si
`apps/api/tsconfig.tsbuildinfo` date d'une compilation précédente et que rien n'a changé dans `src`
— `deleteOutDir: true` (nest-cli.json) vide `dist/` avant coup, mais `tsc` incrémental, se fiant au
cache, saute l'émission en pensant que la sortie correspond déjà. Contournement systématique :
`rm apps/api/tsconfig.tsbuildinfo` avant tout `npm run build:api` de vérification. Pas corrigé dans
le code cette phase (hors périmètre), juste documenté pour la prochaine phase.

## Périmètre exclu

Déclenchement automatique d'une `HousekeepingTask` au check-out (`ReservationsService.checkOut()`
non modifié, Phase 7) ; réouverture d'un `HousekeepingTask` après `INSPECTED` (une inspection ratée
recréerait une nouvelle tâche, non implémenté) ; interface mobile dédiée (§25 "utilisable depuis
mobile" — préoccupation frontend, API déjà mobile-agnostique) ; statut `RESOLVED` sur
`MaintenanceRequest` (représenté par `MaintenanceIntervention.status`, non dupliqué) ; FK `Expense`
additive sur `MaintenanceIntervention` (le cas "coût réel" passe par `Supplier`/`PurchaseOrder`,
Phase 9) ; intervention multi-actifs/multi-chambres (un `assetId`/`roomId` chacun) ; planification
récurrente d'interventions préventives (création individuelle uniquement, comme partout ailleurs) ;
connexion frontend↔backend.
