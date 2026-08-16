# Fondation de tests (Étape 2 — Master Prompt V2)

Première suite de tests automatisés du dépôt (voir `docs/architecture/audit-master-prompt-v2.md`
section P : jusqu'ici, zéro test, toute vérification faite manuellement via `curl` phase par
phase). Périmètre minimum retenu (proposition §W.2 de l'audit) : isolation multi-tenant, intégrité
finance (Revenue/Invoice-Payment), workflow Expense — les trois zones où une régression silencieuse
aurait le plus grand impact (sécurité inter-tenant, argent compté en double, argent bougé au
mauvais moment).

## Choix : e2e contre une vraie base, pas de mocks Prisma

Cohérent avec le principe du projet ("backend = source de vérité", vérification réelle plutôt que
simulée à chaque phase) : les tests bootent l'`AppModule` complet (`Test.createTestingModule`,
tous les guards/interceptors globaux actifs) et frappent une **vraie base PostgreSQL de test**
(`nimbalodge_test`, même conteneur Docker que le dev, base séparée) via de vrais appels HTTP
(`supertest`). Aucun mock de `PrismaService` ou de `AuthService` — le comportement testé est celui
qui tourne réellement, y compris `bcrypt`/JWT/`ValidationPipe`. Les fixtures créées dans les tests
(organisations/hôtels/rôles/utilisateurs de test) sont explicitement autorisées par la directive
"no mock/demo data" (`memory: feedback_production_not_prototype`), qui vise le runtime applicatif,
pas les suites automatisées — elles ne touchent jamais la base de dev/démo ni la production.

## Lancer les tests

```bash
npm run db:up                # démarre Postgres (partagé avec le dev)
cp .env.test.example .env.test   # une fois, ajuster le mot de passe pour qu'il matche .env
npm run db:test:setup        # crée nimbalodge_test si absente + applique les migrations
npm run test:api:e2e         # lance les 3 suites, séquentiellement (--runInBand)
```

`--runInBand` est obligatoire : chaque suite réinitialise entièrement la base
(`TRUNCATE ... CASCADE`, voir `apps/api/test/support/database.ts`) dans son `beforeAll` — exécuter
plusieurs suites en parallèle sur la même base les ferait se corrompre mutuellement.

`testTimeout: 120000` dans `apps/api/test/jest-e2e.json` — le `beforeAll` de chaque suite boote
l'application Nest complète (~30 modules) via ts-jest (pas de build préalable), plus plusieurs
hachages `bcrypt` (coût 12) et appels HTTP séquentiels ; le défaut Jest (5s) ne suffit pas et un
timeout de hook laisse du travail en arrière-plan qui peut polluer la suite suivante (observé une
fois pendant la mise en place — corrigé en augmentant le timeout, pas en réduisant le travail fait).

## Structure

```
apps/api/test/
  support/
    test-app.ts      — boot AppModule complet + mêmes pipes/préfixe que main.ts
    database.ts       — resetDatabase() : TRUNCATE CASCADE entre suites
    fixtures.ts        — organisation/hôtel/rôle/utilisateur de test, catalogue de permissions
    http.ts            — login réel (POST /auth/login) + client HTTP authentifié
  *.e2e-spec.ts         — une suite par zone de risque (voir ci-dessous)
apps/api/tsconfig.test.json — étend tsconfig.json, inclut src/ + test/ + prisma/permissions-catalog.ts
```

## Suites existantes

- **`multi-tenant-isolation.e2e-spec.ts`** — vérifie `assertInScope()` (Étape 1, extrait de ~33
  services vers `apps/api/src/common/utils/assert-in-scope.ts`) sur deux modules distincts
  (`departments`, `financial-categories`) : accès dans le périmètre → 200 ; autre hôtel même
  organisation → 403 "hôtel" ; autre organisation → 403 "organisation" ; sans token → 401 ;
  ressource inexistante → 404 (pas de fuite d'existence cross-tenant).
- **`finance-integrity.e2e-spec.ts`** — vérifie `docs/business-rules/finance.md` §2 : une `Revenue`
  crée exactement une `CashTransaction` IN ; un `Payment` sur facture ne crée **jamais** de ligne
  `Revenue` ; `GET /finance/summary` additionne les deux sources sans double-comptage.
- **`expense-workflow.e2e-spec.ts`** — vérifie `docs/business-rules/finance.md` §3 : aucune
  `CashTransaction` avant `mark-paid` (solde inchangé sur DRAFT/PENDING/APPROVED) ; exactement une
  transaction OUT créée à `mark-paid`, aucune nouvelle à `book` ; sauter une étape (mark-paid direct
  depuis DRAFT) est rejeté (400) sans créer de transaction.

## Ajouter une suite

1. `beforeAll` : `createTestApp()` → `resetDatabase(prisma)` → `seedPermissionCatalog(prisma)` (le
   catalogue de permissions est vidé par `resetDatabase`, à reseeder explicitement par suite).
2. Construire les tenants nécessaires via `createTenant()`/`createOrganizationWithRole()`/
   `createHotelUser()` (`support/fixtures.ts`) — jamais de données insérées à la main sans passer
   par ces helpers, pour que les tests restent alignés sur le seed de référence.
3. `afterAll` : `app.close()`.
4. Toujours passer par de vrais appels HTTP (`authed(app, token)`), jamais appeler un service
   directement — un test qui contourne le controller ne vérifie pas les guards/permissions.

## Hors périmètre de cette étape

Tests unitaires (fonctions pures — calcul de totaux facture, exécution budget), tests frontend
(component/permission/e2e), tests de sécurité dédiés (rate limiting, injection), CI/CD pour
exécuter ces suites automatiquement à chaque push — tout cela reste à faire (voir Étape 5/6 de
`docs/architecture/audit-master-prompt-v2.md` section W).
