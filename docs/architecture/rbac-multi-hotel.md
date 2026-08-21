# RBAC multi-hôtel — HotelMembership, switch-hotel, 9 profils métier

Fait suite à Étape 7 (Production Readiness) et à la série Nimba AI Étape 1-12 (voir
`docs/architecture/nimba-ai.md`). Objectif : un même utilisateur peut désormais détenir un rôle
métier différent sur chaque hôtel auquel il a accès (ex. RESPONSABLE_FINANCIER à l'Hôtel A,
DIRECTEUR_HOTEL à l'Hôtel B), avec un `HotelSwitcher` frontend, un backend qui reste la seule
autorité sur le scope (le frontend ne fait jamais que refléter ce que l'API a déjà décidé), et un
audit trail complet du changement d'hôtel actif.

## Modèle de données — `HotelMembership` en plus de `UserRole`, jamais à sa place

`UserRole` (many-to-many `User`↔`Role`, sans notion d'hôtel) reste le mécanisme des rôles
**globaux/plateforme** — en pratique aujourd'hui, seulement `SUPER_ADMIN`. Un nouveau modèle
`HotelMembership` (`userId`, `hotelId`, `roleId`, `status: ACTIVE|SUSPENDED`,
`@@unique([userId, hotelId])`) porte les rôles **métier**, un par hôtel, jamais rattachés via
`UserRole`. `User.hotelId` (scalaire, inchangé de forme) devient l'hôtel actif de la session
courante — un indice "dernier hôtel actif" que la connexion/le rafraîchissement consultent, jamais
une autorité relue telle quelle (voir `resolveActiveHotelId()` ci-dessous). Migration :
`prisma/migrations/20260821035857_hotel_membership/` (additive — `CreateEnum`/`CreateTable`,
aucune colonne existante modifiée).

**Pourquoi pas un `hotelId` sur `UserRole` plutôt qu'un nouveau modèle ?** Aurait mélangé deux
natures de rôle (plateforme vs métier) dans une même table avec une colonne optionnelle selon le
cas — `HotelMembership` séparé garde `UserRole` simple (toujours global) et rend explicite qu'un
rôle métier n'existe jamais sans hôtel.

## Résolution des permissions — union, jamais un remplacement

`PermissionsService.resolveForUser(userId, activeHotelId)` calcule désormais l'**union** de :
1. les permissions des rôles `UserRole` (toujours actifs, indépendants de l'hôtel — `SUPER_ADMIN`) ;
2. les permissions du rôle `HotelMembership` correspondant à `activeHotelId`, **seulement** si son
   `status` est `ACTIVE` (une membership `SUSPENDED` ne contribue aucune permission).

Chaque appelant (`PermissionsGuard`, `AiOrchestratorService`, `DocumentsService`) est passé de
`resolveForUser(userId)` à `resolveForUser(userId, request.user.hotelId)` — signature étendue, pas
de logique de permission dupliquée ailleurs. `assertInScope()`/`assertInDepartmentScope()`
(`apps/api/src/common/utils/assert-in-scope.ts`) **n'ont pas changé** : ils lisaient déjà
`requester.hotelId`, qui reste le champ JWT de la session active — c'est le point de réutilisation
central de cette étape (consigne explicite : jamais de RBAC parallèle).

## `resolveActiveHotelId()` — jamais élargir silencieusement un accès existant

Point le plus délicat de cette étape, trouvé en cours de route par la suite e2e (46/82 tests
échouaient au premier essai) : `login()`/`refreshTokens()` doivent déterminer l'hôtel actif d'une
session. Un utilisateur avec au moins une `HotelMembership` ACTIVE utilise la logique attendue
(préfère celle correspondant à `User.hotelId` si elle existe, sinon la plus ancienne). Mais un
utilisateur **sans aucune** `HotelMembership` — tout compte antérieur à cette migration, `SUPER_ADMIN`
compris — doit garder EXACTEMENT son comportement d'avant : `preferredHotelId` (= `User.hotelId`)
inchangé. La première implémentation retournait `null` (accès org-wide) dans ce cas, ce qui
élargissait silencieusement l'accès de tout utilisateur hôtel-scopé pré-existant — corrigé avant
tout commit, documenté en commentaire à côté de la fonction (`auth.service.ts`) comme un choix de
compatibilité délibéré, pas un contournement.

## `POST /auth/switch-hotel` — toujours revalidé, jamais accepté tel quel

```
POST /auth/switch-hotel { hotelId }
  → cherche HotelMembership(userId, hotelId)
  → absente ou status ≠ ACTIVE → 403 + audit (action "switch-hotel", outcome FAILURE)
  → sinon → audit SUCCESS → User.hotelId mis à jour (indice, pas autorité)
           → issueTokens() réémet access+refresh avec le nouveau hotelId
```

Un `SUPER_ADMIN` n'a normalement aucune `HotelMembership` (déjà org-wide via `hotelId: null`) et
n'utilise pas cet endpoint — s'il tentait de switcher vers un hôtel sans membership, il recevrait le
même 403 que n'importe quel autre utilisateur, par design (§ aucun contournement silencieux, même
pour la plateforme). `GET /auth/me` expose désormais `hotels: [{id, name, role}]` (toutes les
memberships ACTIVE de l'utilisateur, triées par ancienneté) — alimente le `HotelSwitcher` frontend ;
absent/vide pour un utilisateur org-wide sans membership.

## Frontend — `HotelSwitcher`, cache vidé au switch, jamais de fuite visuelle

`apps/web/src/components/layout/HotelSwitcher.tsx` (nouveau, dans `Topbar.tsx`) : dropdown listant
`user.hotels`, masqué si l'utilisateur a 0 ou 1 hôtel (`hotels.length <= 1`). `useSwitchHotel()`
(`hooks/use-auth.ts`) enchaîne : `POST /auth/switch-hotel` → nouveaux tokens en store →
`queryClient.clear()` (vide **tout** le cache TanStack Query, même pattern que le logout existant)
→ invalide `["auth","me"]`. Sans le `clear()`, un composant pourrait afficher brièvement une donnée
de l'ancien hôtel avant que sa query ne se rafraîchisse — vérifié en direct au navigateur (bascule
Boss entre les 3 hôtels de test, aucune donnée de l'hôtel précédent visible à aucun moment).

Bug trouvé et corrigé en cours de route : une session avec un `AuthUser` persisté en
`localStorage` d'avant l'ajout du champ `hotels` faisait planter `HotelSwitcher`
(`Cannot read properties of undefined`) — garde `const hotels = user?.hotels ?? []`, se
répare de lui-même au prochain `GET /auth/me` frais.

## `HOTEL_ADMIN` → `DIRECTEUR_HOTEL` — mapping confirmé identique, pas une refonte

`HOTEL_ADMIN` reste en base (schéma + `RolePermission`, description mise à jour
`"[Ancien rôle, retiré — voir DIRECTEUR_HOTEL]"`) mais n'est plus attribué à personne par le seed.
`DIRECTEUR_HOTEL` reprend **exactement** le même ensemble de 132 permissions (le même
`hotelAdminPermissionKeys`, appliqué aux deux rôles dans `seed.ts`) — aucun accès ajouté ni retiré,
confirmé avec l'utilisateur avant migration du compte `hoteladmin@nimbalodge.dev`
(`UserRole` supprimée, `HotelMembership → DIRECTEUR_HOTEL` créée). **Suppression de `HOTEL_ADMIN`
explicitement différée** — le temps que toutes les références code/seed/tests/documentation soient
nettoyées ; ne pas le retirer sans revalider qu'aucune référence ne subsiste.

## 7 nouveaux rôles métier — exactement les profils demandés, aucun "Agent Finance/RH"

`BOSS`, `RESPONSABLE_FINANCIER`, `RESPONSABLE_RH`, `RECEPTIONNISTE`, `RESPONSABLE_STOCK`,
`RESPONSABLE_MAINTENANCE`, `HOUSEKEEPING` — ensembles de permissions exacts dans `prisma/seed.ts`,
détail complet dans `docs/architecture/access-matrix.md`. Points de conception notables :
- **BOSS** reçoit tout le catalogue sauf `system-monitoring.view` (réservé plateforme) — mais son
  accès réel dépend entièrement de ses `HotelMembership`, jamais accordé automatiquement.
- **RECEPTIONNISTE** reçoit `finance-invoices.view`/`finance-payments.view`/`.create` (encaisser et
  voir la facture au départ d'un client) mais aucune autre permission Finance — pas de Caisse,
  Banque, Budget, catégories.
- **RESPONSABLE_STOCK** ne reçoit aucune permission Finance — la bascule comptable d'une dépense
  liée aux achats passe par un rôle Finance distinct, décision délibérée à revoir si un futur
  workflow l'exige explicitement.
- **RESPONSABLE_MAINTENANCE** reçoit `products.view`/`stock-movements.view` en lecture seule
  (vérifier la disponibilité de pièces) mais jamais de droit d'écriture sur le stock.
- **HOUSEKEEPING** volontairement minimal (9 permissions) — pensé pour une interface mobile/PWA.

## Gating par permission d'action — pas seulement `.view`

Les Cards Réservations/Chambres/Clients/Stocks (`apps/web/src/features/{reservations,rooms,guests,
inventory}/index.tsx`) n'avaient encore aucun `usePermission()` avant cette étape (contrairement à
Finance/RH, déjà gardés). Chaque bouton de création et chaque action de workflow
(confirmer/check-in/check-out/annuler/no-show) est désormais gardé par sa clé de permission exacte,
même pattern que Finance/RH — cohérence frontend/backend étendue aux 4 modules restants.

## Tests automatisés — le chemin HotelMembership devient une régression permanente

Avant cette étape, le comportement multi-hôtel n'était vérifié qu'à la main (scripts Node ad hoc +
navigateur). Deux nouveaux fichiers e2e convertissent cette vérification manuelle en couverture
automatisée, en réutilisant l'infrastructure existante (`test/support/{fixtures,http,test-app}.ts`,
jamais de JWT signé directement — toujours un vrai `POST /auth/login`) :

- **`test/hotel-membership-rbac.e2e-spec.ts`** (6 tests) : isolation d'un utilisateur mono-hôtel
  (y compris après une tentative de switch refusée), permissions qui changent réellement après un
  switch-hotel réussi entre deux rôles différents sur deux hôtels, refus d'une membership
  `SUSPENDED`, refus cross-organisation même en connaissant l'id de l'hôtel cible, un profil
  multi-hôtel type Boss qui bascule librement entre ses 3 hôtels, 401 sans token.
- **`test/nimba-ai-hotel-membership.e2e-spec.ts`** (4 tests) : les mêmes garanties, mais à travers
  le pipeline Nimba AI plutôt que l'API REST classique — voir section dédiée ci-dessous.
- **`src/modules/nimba-ai/security-invariants.spec.ts`** (garde statique, 4 assertions) : aucun
  fichier de `tools/`, `context/`, `orchestrator/`, `chat/` n'importe `PrismaService` — regarde le
  code source lui-même, pas son comportement, pour empêcher qu'un futur Tool réintroduise un accès
  Prisma direct qui contournerait les Business Services déjà scopés.

Nouveaux helpers de fixture (`test/support/fixtures.ts`, sans toucher `createHotelUser`/
`createUserInHotel`/`createTenant` existants — chemin `UserRole` legacy conservé intact pour tous
les tests déjà écrits) : `createRole()` (2ᵉ rôle dans une organisation existante),
`createHotelMembershipUser()`, `addHotelMembership()`.

## Nimba AI — même RBAC, vérifié explicitement pour le chemin HotelMembership

`AiOrchestratorService.resolveContext()` appelait déjà `resolveForUser(user.id, user.hotelId)` —
aucun changement de code nécessaire côté Nimba AI, la mise à jour de signature suffisait. Ce qui
était vérifié pour la première fois cette étape :

1. **Isolation d'hôtel via les endpoints IA** — un utilisateur mono-hôtel obtient les Insights de
   son hôtel, jamais d'un autre, y compris après une tentative de switch refusée.
2. **Changement de contexte après switch réel** — un même utilisateur, rôle différent par hôtel
   (Finance sur A, Réception sur B), voit ses Insights Finance disparaître et ses Insights
   Réservations apparaître après `switch-hotel`, sans jamais mélanger les deux (vérifié
   numériquement : recette 111000 sur A, 222000 sur B, jamais les deux dans la même réponse).
3. **Aucune fuite via une question en langage naturel qui nomme un autre hôtel** — les 6 Tools
   (`finance-summary`, `hr-payroll-summary`, `hr-workforce-summary`, `occupancy-summary`,
   `department-comparison`, `anomaly-scan`) ne définissent **aucun** paramètre `hotelId` dans leur
   schéma ; l'hôtel résolu vient exclusivement de `context.user.hotelId` (JWT de la session). Une
   question "Quelle est la recette de l'Hôtel A ?" alors que le contexte actif est l'Hôtel B ne peut
   donc **structurellement** jamais renvoyer les chiffres de l'Hôtel A — pas une règle de filtrage
   qui pourrait avoir un trou, une impossibilité d'architecture. Vérifié par test : la réponse du
   chat contient `222000`, jamais `111000`, quel que soit le texte de la question.
4. `nimba-ai.use` reste une porte d'entrée indépendante de toute permission de domaine — un
   utilisateur avec `finance-summary.view` mais sans `nimba-ai.use` reçoit 403 sur les 3 endpoints
   IA (`insights/*`, `chat`, `anomalies`), jamais un accès partiel.
5. Un refus au niveau Tool (permission de domaine manquante alors que `nimba-ai.use` est présent)
   reste audité exactement comme avant (`action: "tool-denied"`, `AuditLog`) — vérifié avec
   `hotelId` = l'hôtel actif de la session au moment du refus, pas celui de la membership par
   défaut de l'utilisateur.

### Constat — `ReportsService.financialReport()` n'applique pas le scope départemental

Trouvé en écrivant le test Nimba AI pour `department-comparison` : contrairement à
`FinanceSummaryService.getSummary()` (qui filtre par `DepartmentsService.getDepartmentIds()`),
`ReportsService.financialReport()` ne filtre **jamais** par les départements assignés au demandeur —
un responsable scopé à un seul département voit les lignes de tous les départements de l'hôtel dès
qu'il a `reports.financial.view`. Comportement **identique** en REST et via le Tool Nimba AI
`department-comparison` (vérifié par un test qui compare les deux réponses ligne à ligne) : ce n'est
donc pas une fuite spécifique à l'IA ni un contournement introduit par cette étape, mais un
comportement pré-existant de `ReportsService`, jamais remarqué faute de test qui l'exerçait. Aucun
des 9 rôles actuels n'a de `UserDepartment` assigné dans le seed — le cas ne s'est encore jamais
présenté en pratique — mais mérite une décision produit avant qu'un rôle département-scopé
n'utilise ce rapport : restreindre comme Finance Summary, ou documenter que ce rapport est
délibérément transverse. **Non corrigé cette étape** — changer un comportement non explicitement
signalé comme un bug par le produit serait sorti du périmètre demandé.

### Constat — aucune route frontend n'a de garde de permission au niveau du routeur

`RequireAuth` (`apps/web/src/components/auth/require-auth.tsx`) ne vérifie que l'authentification
(token valide), jamais la permission. Les 29 routes de `router.tsx` sont donc toutes directement
navigables par n'importe quel utilisateur connecté ; la Sidebar (`nav-config.tsx`) cache les entrées
sans permission pour la découvrabilité, mais une URL tapée à la main affiche la coquille de page
(titres, en-têtes de tableau, formulaires vides) — jamais de donnée, puisque chaque hook de données
appelle un endpoint gardé côté backend et reçoit 403. Cohérent avec la consigne « le frontend qui
cache n'est jamais de la sécurité » : aucune fuite de donnée constatée, mais la structure de la page
(pas son contenu) reste visible à tout utilisateur authentifié quel que soit son rôle. Non traité
cette étape — ajouter une garde de redirection par route serait un vrai changement de comportement
UX (rediriger vs afficher un état vide), à valider avec le produit avant de l'implémenter.

## Comptes de test — développement local uniquement

3 hôtels : Hôtel Nimba Conakry (existant), Hôtel Nimba Kindia, Hôtel Nimba Labé (nouveaux).

| Email | Mot de passe | Rôle | Hôtel(s) |
|---|---|---|---|
| `superadmin@nimbalodge.dev` | `SuperAdmin123!` | SUPER_ADMIN | org-wide (aucune membership) |
| `hoteladmin@nimbalodge.dev` | `HotelAdmin123!` | DIRECTEUR_HOTEL *(migré depuis HOTEL_ADMIN)* | Conakry |
| `boss@nimba-test.com` | `NimbaBoss@2026!` | BOSS | Conakry, Kindia, Labé |
| `directeur@nimba-test.com` | `NimbaDir@2026!` | DIRECTEUR_HOTEL | Conakry |
| `finance@nimba-test.com` | `NimbaFin@2026!` | RESPONSABLE_FINANCIER | Conakry |
| `rh@nimba-test.com` | `NimbaRH@2026!` | RESPONSABLE_RH | Conakry |
| `reception@nimba-test.com` | `NimbaRec@2026!` | RECEPTIONNISTE | Conakry |
| `stock@nimba-test.com` | `NimbaStock@2026!` | RESPONSABLE_STOCK | Conakry |
| `maintenance@nimba-test.com` | `NimbaMaint@2026!` | RESPONSABLE_MAINTENANCE | Conakry |
| `housekeeping@nimba-test.com` | `NimbaHouse@2026!` | HOUSEKEEPING | Conakry |

**⚠️ Identifiants de développement local uniquement — jamais créés en production**
(`prisma/bootstrap-production.ts`, non touché cette étape, ne crée toujours qu'une Organization +
un compte `SUPER_ADMIN` réel).

## Vérification

- `npm run typecheck` (source + `typecheck:test`) et `npm run build:api` — verts.
- `npm run test:api:unit` — **36 suites / 145 tests**, dont les 4 nouvelles assertions du garde
  statique Nimba AI.
- `npm run test:api:e2e` — **17 suites / 92 tests**, dont les 10 nouveaux tests HotelMembership
  (6 génériques + 4 Nimba AI).
- Vérification manuelle au navigateur (Chrome) : `HotelSwitcher` de bout en bout (bascule Boss sur
  ses 3 hôtels, cache vidé, aucune fuite visuelle), nav filtrée pour un rôle minimal
  (HOUSEKEEPING), gating de boutons pour 2 rôles supplémentaires. **Non ré-exécuté cette étape** :
  un parcours Chrome exhaustif des 9 profils × 29 routes (261 combinaisons) — les tests e2e
  frappent les vraies routes REST avec de vrais tokens scopés par rôle (preuve backend réelle), ce
  qui couvre l'autorisation mais pas le rendu visuel de chaque écran pour chaque profil.

## Fichiers modifiés (résumé)

**Schéma/migration** : `prisma/schema.prisma`, `prisma/migrations/20260821035857_hotel_membership/`.
**Backend RBAC** : `permissions.service.ts`, `permissions.guard.ts`,
`nimba-ai/orchestrator/ai-orchestrator.service.ts`, `documents.service.ts` (signature
`requirePermission` élargie à `AuthenticatedUser`). **Backend Auth** : `auth.service.ts`
(`resolveActiveHotelId`, `switchHotel`, `resolveMe` enrichi), `auth.controller.ts`
(`POST /auth/switch-hotel`), `dto/switch-hotel.dto.ts` (nouveau). **Seed** : `prisma/seed.ts`
(9 rôles, 3 hôtels, 10 comptes). **Frontend** : `stores/auth-store.ts`, `services/auth.ts`,
`hooks/use-auth.ts`, `components/layout/{HotelSwitcher.tsx (nouveau), Topbar.tsx}`,
`features/settings/index.tsx`, `features/{reservations,rooms,guests,inventory}/index.tsx`
(gating). **Tests** : `test/support/fixtures.ts` (helpers additifs),
`test/hotel-membership-rbac.e2e-spec.ts` (nouveau), `test/nimba-ai-hotel-membership.e2e-spec.ts`
(nouveau), `src/modules/nimba-ai/security-invariants.spec.ts` (nouveau).
**Documentation** : ce fichier, `docs/architecture/access-matrix.md`,
`docs/architecture/frontend-routes.md`, mise à jour de `docs/architecture/nimba-ai.md` et
`docs/security/overview.md`.

## Périmètre exclu

Suppression effective de `HOTEL_ADMIN` (différée, voir plus haut) ; correction du scope
départemental de `ReportsService`/`department-comparison` (constat, pas un bug signalé cette
étape) ; garde de permission au niveau du routeur frontend (constat, changement UX à valider) ;
CRUD d'écriture Rôles/Permissions et gestion de membership via l'UI (`POST/DELETE
/users/:id/hotel-memberships` n'existe pas — les memberships de test sont créées uniquement par le
seed) ; parcours navigateur exhaustif des 261 combinaisons profil × route ; tests frontend
automatisés (aucun framework de test frontend n'existe dans ce projet — substitué par vérification
manuelle Chrome, comme pour toutes les étapes précédentes).
