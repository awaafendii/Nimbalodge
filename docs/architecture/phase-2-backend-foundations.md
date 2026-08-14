# Phase 2 — Base PostgreSQL + Prisma & architecture backend

Décisions prises lors de la mise en place du socle backend, en parallèle du frontend (Phase 1)
et du prototype `nimbalodge-app/` qui reste gelé et inchangé.

## Contrainte d'environnement

Cette machine Windows n'a ni Docker ni WSL. Une installation PostgreSQL 18 native existe
(`C:\Program Files\PostgreSQL\18`) mais est incomplète (`pg_ctl`/`initdb` absents du dossier
`bin`, aucun service Windows enregistré, port 5432 muet) — insuffisante pour servir de base de
dev fiable. L'utilisateur a choisi d'installer Docker Desktop lui-même ; c'est donc l'option
retenue pour Postgres, avec un `docker-compose.yml` prêt à l'emploi dès que Docker sera
disponible.

## Postgres via Docker uniquement — pas encore de Redis

`docker-compose.yml` ne déclare que le service `postgres`. Redis et le stockage objet (§41 du
brief) sont dans la stack cible, mais rien ne les utilise encore (pas de cache, pas de sessions,
pas de documents à stocker) — les ajouter maintenant serait de l'infrastructure morte, non
vérifiable. Ils seront ajoutés à `docker-compose.yml` dans la phase qui en a réellement besoin
(sessions/refresh tokens en Phase 3, documents en Phase 12, agrégation analytics plus tard).

## `prisma/schema.prisma` à la racine, zéro modèle métier

Conforme à l'arborescence cible du brief (§42 : `prisma/{schema.prisma,migrations,seed}` au
même niveau que `apps/` et `packages/`, pas sous `apps/api`). Organizations/Hotels/Departments/
Activities/CostCenters ont leur propre phase nommée (Phase 4), Users/Roles/Permissions la leur
(Phase 3) ; les anticiper ici referait la même erreur que d'avoir mélangé les concepts métier
avant d'avoir le socle générique.

**Ajustement technique découvert à l'exécution** : `prisma generate` refuse de tourner sur un
schéma sans aucun `model` (`Error: You don't have any models defined in your schema.prisma`).
Le schéma contient donc un unique modèle `SchemaBootstrap`, explicitement documenté en commentaire
comme purement technique (aucune signification métier), dont le seul rôle est de satisfaire cette
contrainte de l'outillage et de prouver que la première migration s'applique réellement sur
Postgres. Il sera supprimé dès que la Phase 4 introduit les premiers modèles métier réels.

## Pas de `packages/database`, génération par défaut du client Prisma

Seul `apps/api` consomme Prisma pour l'instant. Un `packages/database` séparé (avec `output`
personnalisé et réexport) n'apporterait aucun bénéfice tant qu'une 2ᵉ app ne parle pas
directement à Postgres (`apps/mobile`, s'il existe un jour, passera par l'API REST, pas par un
accès direct à la base). Le client se génère donc à l'emplacement par défaut
(`node_modules/.prisma/client`), résolu normalement par `apps/api` via l'hoisting npm
workspaces. `prisma` (CLI) est une devDependency **racine** (le schéma vit à la racine, les
scripts `db:*` tournent depuis la racine) ; `@prisma/client` (runtime) est une dependency
d'`apps/api`. Les deux doivent rester sur la même version majeure/mineure — contrainte Prisma.
À réévaluer si une 2ᵉ app backend apparaît.

## `apps/api` en CommonJS, pas ESM

Contrairement au reste du monorepo (`apps/web`, `packages/*`, tous en ESM), `apps/api` reste en
CommonJS : l'outillage NestJS (décorateurs, `emitDecoratorMetadata`, `@nestjs/cli`, `ts-node`)
est documenté et éprouvé en CommonJS, le support ESM de Nest reste plus fragile (ordre
d'évaluation des décorateurs, imports circulaires). `apps/api/tsconfig.json` étend
`tsconfig.base.json` mais **surcharge** `module`/`moduleResolution`/`experimentalDecorators`/
`emitDecoratorMetadata` — la base racine est pensée pour Vite (`ESNext`/`Bundler`), incompatible
avec le runtime Node/CommonJS de Nest. Chaque app garde son propre `type` de module ; rien n'est
partagé en code exécuté à la fois côté front ESM et API CommonJS pour l'instant (les partages
futurs passeront par `packages/types`/`packages/validation`, consommés en source `.ts`,
indépendants du mode module runtime de chaque app).

## `PrismaService` / `PrismaModule` — pattern NestJS standard

`PrismaService extends PrismaClient` avec `OnModuleInit`/`OnModuleDestroy` pour `$connect`/
`$disconnect` proprement au cycle de vie de l'app. `PrismaModule` est `@Global()` : importé une
seule fois dans `AppModule`, `PrismaService` est injectable partout sans réimport — pattern
recommandé par la documentation Prisma pour NestJS.

## `HealthModule` réel, pas un placeholder

`GET /api/v1/health` exécute `SELECT 1` via Prisma pour prouver la connectivité DB réelle (pas
une simple réponse statique), retourne `200 {status:"ok", database:"connected"}` ou `503` avec le
détail de l'erreur si la base est injoignable. Pas de dépendance `@nestjs/terminus` : la sonde
nécessaire ici est triviale, un hand-roll évite une dépendance non requise par le brief.

## Port `4000`, CORS restreint à `apps/web`

`API_PORT=4000` par défaut : évite le 3000 par défaut de Nest (souvent squatté par d'autres
outils locaux), ne collisionne ni avec 5173 (`nimbalodge-app`) ni 5174 (`apps/web`). CORS
restreint à `CORS_ORIGIN` (= `http://localhost:5174`) plutôt qu'ouvert — resserré dès le socle,
pas laissé permissif "pour plus tard".

## Validation d'environnement via class-validator, pas de nouvelle dépendance

`src/config/env.validation.ts` valide `NODE_ENV`/`API_PORT`/`DATABASE_URL`/`CORS_ORIGIN` avec
class-validator/class-transformer — déjà nécessaires pour les futurs DTO (§53 du brief : "DTO +
validation stricte"). Pas de Joi ni de zod ajoutés pour ce seul usage.

## Chargement de `.env` : `dotenv-cli` sur `dev:api`, rien pour les scripts Prisma

`npm run dev:api` = `dotenv -e .env -- npm run dev -w @nimbalodge/api` : précharge `.env` dans
`process.env` avant que Nest ne démarre, plutôt qu'un chemin relatif fragile
(`envFilePath: '../../.env'`) qui casserait si la profondeur d'`apps/api` change. Les scripts
`db:*` n'en ont pas besoin : la CLI Prisma charge nativement `.env` depuis le répertoire courant
(la racine, où tournent ces scripts).

## Pas de dossiers placeholder pour les 29 modules métier ni pour common/guards/interceptors/pipes/utils

Différence assumée avec la Phase 1 : chaque `ComingSoon` d'`apps/web/src/features/*` est un
composant **réellement rendu**, utile à quelqu'un qui navigue dans l'app. Un dossier NestJS vide
ne démontre rien — un module Nest n'existe "vraiment" que déclaré dans `app.module.ts` avec au
moins un provider/controller. Créer maintenant `src/modules/{auth,organizations,hotels,
departments,users,roles,permissions,finance,budgets,revenues,expenses,cash,banking,billing,
reservations,rooms,guests,hr,payroll,purchases,suppliers,inventory,housekeeping,maintenance,
reports,analytics,notifications,documents,audit,ai}/` vides créerait un faux signal de
progression et figerait une convention interne avant que chaque phase ne la définisse
réellement. Même raisonnement pour `common/`, `guards/`, `interceptors/`, `pipes/`, `utils/` :
un guard RBAC n'a de sens qu'à partir de la Phase 3, un interceptor d'audit qu'à partir de la
Phase 12. La liste des 29 modules cibles (§44 du brief) reste une feuille de route documentée
ici, pas une arborescence physique prématurée.

## Vérification — deux temps (les deux effectuées)

**Sans Docker** :
- `npm install` à la racine installe `apps/api` sans impacter `apps/web`/`packages/*`.
- `npm run db:generate` — `prisma generate` ne nécessite aucune base vivante, uniquement un
  schéma syntaxiquement valide.
- `npm run typecheck` passe sur `apps/api` (ne se connecte pas à la DB).
- `npm run build:api` compile sans erreur.
- Démarrage sans base : Nest boot, tous les modules s'initialisent, la route `/api/v1/health`
  se mappe, puis échec propre et structuré : `PrismaClientInitializationError: Can't reach
  database server at localhost:5432` (code `P1001`), exit 1 — comportement attendu.
- Non-régression : `apps/web` et `nimbalodge-app` non impactés.

**Avec Docker (Docker Desktop installé par l'utilisateur, engine WSL2 démarré)** :
1. `npm run db:up` → `docker compose ps` confirme `healthy` sur `nimbalodge-postgres`.
2. `npm run db:migrate` → migration `20260814160334_bootstrap` créée et appliquée (contient
   uniquement la table technique `SchemaBootstrap` + le suivi Prisma).
3. API démarrée contre la base réelle → log `[PrismaService] Connexion PostgreSQL établie` →
   `curl http://localhost:4000/api/v1/health` → `{"status":"ok","database":"connected",...}`
   HTTP 200. Pipeline Docker → Prisma → NestJS confirmé de bout en bout.

**Anomalie d'environnement découverte et contournée** : `nest start --watch` (mode watch) subit
une race condition Windows reproductible — le process enfant (`node dist/main`) est parfois
lancé avant que le fichier fraîchement compilé ne soit visible sur le disque
(`Cannot find module '...\dist\main'`), et peut aussi laisser un processus orphelin qui bloque
le port au redémarrage suivant (`EADDRINUSE`). `nest build` (non-watch) n'est jamais affecté par
cette race. Pour le développement au quotidien, privilégier au besoin `npm run build:api` suivi
d'un lancement direct de `node apps/api/dist/main.js` si `npm run dev:api` se révèle instable
sur cette machine ; ce n'est pas un défaut du scaffold (confirmé par plusieurs démarrages
propres et reproductibles via le build direct).
