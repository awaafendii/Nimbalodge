# Phase 3 — Auth, utilisateurs, rôles, permissions, isolation hôtel

Décisions prises pour le socle RBAC, en parallèle du frontend (`apps/web`, inchangé cette phase)
et du backend d'infrastructure posé en Phase 2.

## `SchemaBootstrap` supprimé (pas attendu la Phase 4)

Le commentaire laissé en Phase 2 annonçait sa suppression "dès que la Phase 4 introduit les
premiers modèles métier réels" — mais Phase 3 introduit ces modèles avant Phase 4. Son unique
rôle (prouver que `prisma generate`/`migrate` fonctionne sans modèle métier) est obsolète dès
qu'un vrai modèle existe : il est donc supprimé dans la même migration qui crée les 8 nouvelles
tables (`DROP TABLE` + créations), plutôt que de cohabiter inutilement avec le vrai schéma.

## `Organization` / `Hotel` minimaux — ancrage FK uniquement

Décision actée avec le client avant cette phase : pas de configuration hôtel complète (§4 du
brief), pas de CRUD dédié (`/organizations`, `/hotels` n'existent pas encore) — seulement de quoi
que `User.organizationId`/`hotelId` pointent vers une ligne réelle et que l'isolation par hôtel
soit démontrable maintenant. La Phase 4 enrichira ces mêmes tables (départements, activités,
centres de coûts, endpoints de gestion complets) sans les recréer.

## Rôles : table DB, pas enum — séparation ROLE / SCOPE

`Role.organizationId` nullable : `null` = rôle système global (ex. `SUPER_ADMIN`, seedé une
fois), renseigné = rôle personnalisé propre à une organisation — satisfait "les rôles doivent
être personnalisables" (§28). Pas de `hotelId` sur `Role` : le *scope* (organisation vs hôtel)
est porté par `User.hotelId`, pas dupliqué sur la définition du rôle lui-même — c'est la
séparation ROLE (ce que l'utilisateur peut faire) / SCOPE (sur quelles données) demandée par
§29, sans dupliquer l'information à deux endroits. `User↔Role` en many-to-many (`UserRole`) : un
utilisateur peut cumuler plusieurs rôles.

**Limite connue, sans impact actuel** : `@@unique([organizationId, name])` ne dédoublonne pas les
rôles globaux entre eux (Postgres traite chaque `NULL` comme distinct) — seul le seed crée des
rôles globaux pour l'instant, donc pas de risque de doublon en pratique.

## JWT — payload minimal, refresh révocable

Access token (15 min) : payload minimal `{sub, organizationId, hotelId}`, **sans permissions
embarquées** — il n'y a pas de Redis (rien n'en dépend encore, décision Phase 2), donc un payload
figé deviendrait périmé dès qu'un rôle change avant expiration. `PermissionsGuard` résout les
permissions à chaque requête via Prisma (`UserRole→Role→RolePermission→Permission`).

Refresh token (7 j) : JWT signé avec un secret **distinct** (`JWT_REFRESH_SECRET`), payload
`{sub, jti}`. Une ligne `RefreshToken` en base (id = `jti`, `tokenHash` en SHA-256 du token brut
— jamais stocké en clair, `expiresAt`, `revokedAt` nullable) le rend **révocable** : rotation à
chaque `/auth/refresh` (l'ancien est marqué révoqué dès qu'il sert), révocation explicite au
`/auth/logout`.

## Mots de passe : `bcryptjs`, pas `bcrypt`

`bcryptjs` est du JS pur, sans compilation native (pas de dépendance à node-gyp/Visual Studio
Build Tools) — évite un nouveau point de friction toolchain sur cette machine Windows, où une
anomalie d'environnement est déjà documentée (Phase 2, race condition `nest start --watch`).

## 2FA préparé, pas implémenté

`User.twoFactorEnabled` (`@default(false)`) + `User.twoFactorSecret` nullable — uniquement les
colonnes préparatoires demandées par le brief §41 ("2FA préparé"). Aucun flow TOTP, aucun
endpoint `/auth/2fa/*` cette phase.

## Rate limiting ciblé sur login/refresh

`@nestjs/throttler`, avec un throttler global permissif (100 req/min, `ThrottlerModule.forRoot`
dans `app.module.ts`) et un `@Throttle({ default: { limit: 5, ttl: 60_000 } })` resserré
uniquement sur `POST /auth/login` et `POST /auth/refresh` — les endpoints les plus exposés au
brute-force que cette phase crée elle-même (§52). Pas de throttling global agressif sur le reste
de l'API, hors périmètre.

## Isolation hôtel démontrée via `/users`

`GET /users` filtre par `requester.hotelId` : `null` (rôle org-wide type `SUPER_ADMIN`) → tous
les users de l'organisation ; renseigné → uniquement les users du même hôtel. `GET /users/:id`
applique la même règle (403 si hors périmètre organisation/hôtel). Choix délibéré : les
utilisateurs sont la seule donnée hôtel-scopée qui existe déjà en Phase 3 (pas de département/
activité avant Phase 4), donc c'est la façon la plus honnête de démontrer l'isolation
maintenant plutôt que d'attendre.

## Rôles/Permissions en lecture seule cette phase

`GET /roles`, `GET /permissions` seulement — pas de CRUD d'écriture. `apps/web` reste inchangé,
aucun consommateur frontend pour un éditeur de rôles cette phase ; le schéma (table, pas enum)
suffit déjà à prouver que la personnalisation est possible.

## `login`/`refresh`/`logout` publics, `/health` aussi

`@Public()` exempte une route des deux guards globaux (`JwtAuthGuard`, `PermissionsGuard`,
enregistrés dans `AuthModule` via `APP_GUARD`). Nécessaire sur `login`/`refresh`/`logout` — sinon
deadlock (impossible d'obtenir un token sans en présenter un). `health.controller.ts` reçoit
aussi `@Public()`, sous peine de régresser le contrat Phase 2 (healthcheck Docker/monitoring).

## Ajustements techniques découverts à l'exécution

- **Upsert Prisma sur clé composée avec `null`** : `prisma.role.upsert()` sur `organizationId_name`
  refuse `null` pour `organizationId` au runtime (Postgres l'autorise en stockage — plusieurs
  `NULL` sont distincts — mais Prisma Client valide plus strictement les upserts sur clé
  composée). Contournement : `findFirst` + `create` manuel pour le rôle global `SUPER_ADMIN`
  uniquement (`prisma/seed.ts`).
- **`ts-node` + `prisma db seed`** : après avoir ajouté `"type": "commonjs"` à la racine (pour
  supprimer un warning ESM/CJS), `ts-node` a commencé à échouer **silencieusement** (exit 0, zéro
  sortie, aucune ligne créée en base) en mode type-checké normal ; en `--transpile-only` l'erreur
  réelle apparaissait : `TS5109: moduleResolution must be set to 'NodeNext' when module is set to
  'NodeNext'` — `ts-node` infère `module: NodeNext` depuis le `package.json` racine sans aligner
  `moduleResolution`, un conflit connu de l'outillage. Corrigé avec un `prisma/tsconfig.json`
  dédié (`module`/`moduleResolution: commonjs`/`node`, aligné sur le pattern déjà utilisé par
  `apps/api`) et `"seed": "ts-node --project prisma/tsconfig.json prisma/seed.ts"` dans le bloc
  `prisma` du `package.json` racine — pointeur explicite plutôt que dépendre de l'auto-détection.

## Identifiants de seed — développement local uniquement

`prisma/seed.ts` (idempotent, `npm run db:seed`) crée 1 organisation, 1 hôtel, les permissions de
base, les rôles `SUPER_ADMIN` (toutes permissions) et `HOTEL_ADMIN` (`users.view`/`users.create`
seulement — pour rendre visible la différenciation), et 2 utilisateurs de test :

| Email | Mot de passe | Rôle | hotelId |
|---|---|---|---|
| `superadmin@nimbalodge.dev` | `SuperAdmin123!` | SUPER_ADMIN | `null` (org-wide) |
| `hoteladmin@nimbalodge.dev` | `HotelAdmin123!` | HOTEL_ADMIN | Hôtel Nimba Conakry |

**⚠️ Identifiants de développement local uniquement — jamais utilisés en production.**

## Vérification en base réelle

1. `npm run db:up` → `npm run db:migrate` (drop `SchemaBootstrap`, création des 8 tables) →
   `npm run db:seed`.
2. `npm run build:api` puis `node apps/api/dist/main.js`.
3. Login SUPER_ADMIN → `GET /auth/me` (rôles/permissions résolus) → `GET /users` retourne les 2
   users seedés (scope org-wide).
4. Login HOTEL_ADMIN → `GET /users` ne retourne que lui-même (son hôtel) — pas le SUPER_ADMIN —
   preuve d'isolation. `GET /users/:id` sur l'id du SUPER_ADMIN → 403.
5. `POST /auth/refresh` → nouveaux tokens ; rejouer l'ancien refresh token → 401 (rotation).
   `POST /auth/logout` puis rejouer ce refresh token → 401 (révocation).
6. `GET /users` sans header `Authorization` → 401 (deny-by-default).

## Périmètre exclu

Départements/activités/centres de coûts et CRUD complet Organization/Hotel (Phase 4) ; audit
trail (Phase 12) ; flow 2FA fonctionnel ; connexion frontend↔backend (`apps/web` inchangé) ; CRUD
d'écriture Rôles/Permissions ; `PATCH`/`DELETE` sur `/users`.
