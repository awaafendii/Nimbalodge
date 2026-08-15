# Phase 4 — Organisation, hôtels, départements, activités, centres de coûts

Décisions prises pour donner une vraie capacité de configuration structurelle, en enrichissant
`Organization`/`Hotel` (minimaux depuis la Phase 3) et en ajoutant `Department`,
`DepartmentActivity`, `CostCenter`, `UserDepartment`. `apps/web` reste inchangé (même précédent
que Phases 2-3 : `features/settings` reste `ComingSoon`).

## Profondeur CRUD, entité par entité

- **Organization** : lecture seule (`GET /organizations/:id`). Une organisation est provisionnée
  une fois (ops/seed) — aucun flow produit "créer une organisation" n'existe à ce stade. Même
  traitement que Rôles/Permissions en Phase 3 (rien n'exploiterait l'écriture).
- **Hotel / Department / Activity / CostCenter** : CRUD complet (create/read/update), **jamais de
  `DELETE`** réel — `isActive` désactive à la place, cohérent avec le champ `status` demandé aux
  §5-8 du brief, et évite les problèmes de cascade avec les données que Phase 5+ référencera
  (`CostCenter` notamment).

## Enrichissement de `Hotel`

Ajoutés (tous nullable) : `address`, `phone`, `email`, `website`, `category` (texte libre, pas
d'enum — cohérent avec "jamais coder en dur"), `timezone`, `languages` (`String[]`), `logoUrl`,
`isActive`.

**Exclus délibérément** :
- `currency` — le mot "devise" réapparaît nommément dans la section FINANCE du brief §4, dont le
  périmètre appartient aux Phases 5/6 (leurs titres le nomment explicitement).
- `roomsCount` — deviendrait une 2ᵉ source de vérité dès que `Room` existera (Phase 7,
  `COUNT(*)` sur les chambres réelles serait alors la seule vérité).
- Toute config FINANCE (exercice financier, règles fiscales, numérotation factures, comptes
  comptables, méthodes de paiement, comptes caisse/banque) — Phase 5/6.
- Table "modules actifs" par hôtel — voir plus bas.

## `CostCenter` : deux FKs, pas un cycle

Le brief liste `cost_center_id` sur `Department` (§6) ET `department_id` sur `CostCenter` (§8).
Décision : **`CostCenter.hotelId`** (requis, direct) + **`CostCenter.departmentId`** (nullable —
permet un centre de coût transverse, ex. "Administration générale", non rattaché à un
département unique). `Department` n'a **pas** de `costCenterId` : la relation inverse
(`department.costCenters[]`) suffit, évite un cycle et la question "quel FK gagne" si les deux
divergent. Schéma en étoile `Hotel → Department → CostCenter`, suffisant pour tout ce que
Phase 5+ demandera (agréger par centre de coût, remonter au département, à l'hôtel).

## `Department.managerId` et département par défaut

`managerId` : FK nullable vers `User`, validée en service (même hôtel que le département — même
pattern que la validation `hotelId` déjà faite dans `UsersService.create()`), pas en contrainte
DB. Département "Administration générale" (§48) : **pas auto-créé silencieusement**. `POST
/hotels` accepte un flag optionnel `createDefaultDepartment` (défaut `false`) — s'il est vrai, le
département est créé dans la même transaction que l'hôtel, mais reste ensuite modifiable/
renommable/désactivable comme n'importe quel autre département (aucun statut spécial en base).
La notion de "dépenses non affectées" (§48) n'est pas modélisée — aucune dépense n'existe avant
Phase 5, ce serait une colonne orpheline.

## Table "modules actifs" (§4 MODULES) : différée

Non modélisée cette phase. Togglable n'a de sens qu'une fois qu'un vrai module existe à toggler —
tout `apps/web` est encore `ComingSoon`, aucune Phase 5+ n'a démarré. Décision explicite pour ne
pas l'oublier silencieusement : sera introduite quand la première phase consommatrice (Finance,
Phase 5) existera réellement.

## `UserDepartment`

Table de jointure many-to-many créée (`userId`, `departmentId`, PK composée — même pattern que
`UserRole`), complétant §27 ("un utilisateur peut être associé à un ou plusieurs départements"),
impossible à faire en Phase 3 tant que `Department` n'existait pas. **Aucune exploitation dans
les guards d'isolation** : le roadmap ne nomme "isolation hôtel" qu'en Phase 3, pas "isolation
département" ici — l'introduire maintenant anticiperait une phase non spécifiée sans qu'aucune
donnée département-scopée (dépenses, budgets, plannings) n'existe encore pour la justifier.

## Permissions et rôles seed

Nouvelles clés : `organizations.view`, `hotels.view/create/update`,
`departments.view/create/update`, `activities.view/create/update`,
`cost-centers.view/create/update`. `SUPER_ADMIN` : toutes (déjà le pattern). `HOTEL_ADMIN` :
tout sauf `hotels.create`/`hotels.update` — gérer le portefeuille d'hôtels d'une organisation est
une opération org-wide, pas celle d'un admin scopé à un seul hôtel (cohérent avec sa description
seed "accès limité à son propre hôtel").

## Scoping hôtel — généralisation du pattern `UsersService`

Même mécanisme que `UsersService.list()`/`assertInScope()` (Phase 3), répliqué dans
`HotelsService`, `DepartmentsService`, `ActivitiesService`, `CostCentersService` : **dérivé
automatiquement du demandeur, jamais d'un `hotelId` en query param** (empêcherait un hôtel-scopé
de contourner l'isolation en le fournissant lui-même). Org-wide (`hotelId === null`) voit tout
son organisation ; hôtel-scopé ne voit que son hôtel. En écriture : hôtel-scopé ne peut créer que
dans son propre hôtel, org-wide doit fournir `hotelId` explicitement dans le corps de la requête.
`Activity`/`CostCenter` dérivent leur hôtel via la relation (`department.hotelId` ou
`costCenter.hotelId` direct), pas via un champ dupliqué non validé.

## Vérification en base réelle

1. `npm run db:up` → `npm run db:migrate` (nouvelle migration, 4 tables + `Hotel` enrichi) →
   `npm run db:seed` (17 permissions au total désormais).
2. `npm run build:api` puis `node apps/api/dist/main.js` (contournement Windows déjà documenté).
3. Login SUPER_ADMIN → `POST /hotels` (`createDefaultDepartment: true`) → 201 + département
   "Administration générale" auto-créé, vérifié via `GET /departments`.
4. `POST /departments`, `POST /activities`, `POST /cost-centers` rattachés au nouvel hôtel → 201
   chacun.
5. `GET /hotels` en SUPER_ADMIN → 2 hôtels (scope org-wide).
6. Login HOTEL_ADMIN → `GET /hotels` → uniquement son propre hôtel. `GET /departments` →
   uniquement ceux de son hôtel, pas ceux du nouvel hôtel — preuve d'isolation identique à
   Phase 3.
7. `POST /hotels` en HOTEL_ADMIN → 403 (permission `hotels.create` non attribuée).
8. `GET /departments` sans `Authorization` → 401.

## Périmètre exclu

Catégories financières et configuration FINANCE de l'hôtel (Phase 5/6, y compris
`Hotel.currency`) ; `roomsCount` (Phase 7) ; table "modules actifs" (différée) ; CRUD d'écriture
Rôles/Permissions (déjà tranché Phase 3) ; connexion frontend↔backend ; isolation par
département dans les guards ; "dépenses non affectées" ; `DELETE` réel sur toute entité.
