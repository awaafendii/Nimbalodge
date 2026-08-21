# Sécurité — vue d'ensemble

Référence normative pour tout ce qui touche à l'authentification, l'autorisation, l'audit, les
uploads et la supervision de NimbaLodge. Consolidé à l'issue d'Étape 7 (durcissement Production
Readiness, post-Phase 14 / Étape 6 Offline) — avant cette étape, chacun de ces sujets existait mais
n'était vérifié qu'au fil des phases fonctionnelles, sans passe dédiée ni tests systématiques. En
cas de divergence future entre ce document et le code, le code fait foi pour le comportement exact,
mais toute divergence doit être traitée comme un bug de documentation à corriger, pas comme une
mise à jour silencieuse de la règle.

## 1. RBAC (autorisation)

- **Catalogue de permissions** : `prisma/permissions-catalog.ts`, format plat uniforme
  `<ressource>.<action>` (ex. `finance-expenses.approve`, `audit-logs.view`,
  `system-monitoring.view`). Partagé entre `seed.ts` (dev) et `bootstrap-production.ts` (prod) —
  infrastructure de schéma, pas une donnée métier.
- **Garde fail-closed** : `PermissionsGuard` (`apps/api/src/common/guards/permissions.guard.ts`)
  refuse par défaut. Une route doit déclarer explicitement soit `@RequirePermissions(...)`, soit
  `@Public()`, soit `@AuthenticatedOnly()` (authentification seule, aucune permission spécifique).
  Une route sans aucun de ces trois décorateurs est refusée pour tout le monde, y compris un
  utilisateur authentifié — inversion volontaire du comportement par défaut de NestJS.
- **Scopes** : organisation → hôtel → département, vérifiés via `assertInScope()` /
  `assertInDepartmentScope()` (`apps/api/src/common/utils/assert-in-scope.ts`), fonctions pures
  réutilisées par ~30 services. Un demandeur org-wide (`hotelId` JWT `null`) voit toute son
  organisation ; un demandeur hôtel-scopé ne sort jamais de son hôtel ; un demandeur avec au moins
  une affectation département (`UserDepartment`) est en plus restreint à ses département(s) — scope
  additif, jamais substitutif.
- **Rôles seedés (dev/démo uniquement)** : `SUPER_ADMIN` reçoit tout le catalogue ; 8 rôles métier
  (`BOSS`, `DIRECTEUR_HOTEL`, `RESPONSABLE_FINANCIER`, `RESPONSABLE_RH`, `RECEPTIONNISTE`,
  `RESPONSABLE_STOCK`, `RESPONSABLE_MAINTENANCE`, `HOUSEKEEPING`) reçoivent chacun un sous-ensemble
  explicite (`prisma/seed.ts`) qui exclut volontairement les opérations org-level
  (`hotels.create/update`, `finance-expenses.book`, `system-monitoring.view`, ...). Détail complet :
  `docs/architecture/access-matrix.md`. En production, seul `SUPER_ADMIN` est créé par
  `bootstrap-production.ts` — tout autre rôle est créé par l'opérateur lui-même depuis
  l'application.
- **Multi-hôtel (`HotelMembership`)** : un rôle métier n'est jamais attribué via `UserRole`
  (réservé aux rôles plateforme, aujourd'hui seulement `SUPER_ADMIN`) mais via une
  `HotelMembership(userId, hotelId, roleId, status)` — un utilisateur peut détenir un rôle
  différent par hôtel. `PermissionsService.resolveForUser(userId, activeHotelId)` calcule l'union
  des permissions `UserRole` (toujours actives) et de la `HotelMembership` de l'hôtel actif
  (seulement si `status: ACTIVE`). `POST /auth/switch-hotel` revalide toujours contre une
  membership ACTIVE réelle avant de réémettre les tokens — jamais un `hotelId` accepté tel quel
  depuis le client. Détail : `docs/architecture/rbac-multi-hotel.md`.
- **Cohérence frontend/backend** : chaque bouton/action sensible du frontend est gardé par la même
  clé de permission que son endpoint backend (vérifié systématiquement Étape 7, Priority 1).

## 2. Audit Trail

- **Modèle** `AuditLog` (`prisma/schema.prisma`) : `organizationId`, `hotelId`, `departmentId`,
  `userId`, `method`, `path`, `resourceType`, `resourceId`, `action`, `outcome`
  (`SUCCESS`/`FAILURE`), `errorMessage`, `ipAddress`, `before`/`after` (JSONB), `createdAt`.
- **Point d'écriture unique** : `AuditService.record()` (`apps/api/src/common/audit/audit.service.ts`),
  best-effort (`.catch`, jamais bloquant pour la requête réelle qu'il journalise). Un test qui lit
  le journal juste après une mutation doit sonder/attendre plutôt que lire une seule fois
  immédiatement (voir `apps/api/test/audit-logs.e2e-spec.ts`, `waitForAuditEntry`).
- **Trois points de capture**, chacun couvrant ce que les autres ne peuvent pas voir :
  - `AuditInterceptor` (global) : toute requête `POST/PATCH/PUT/DELETE`, avec snapshot "before"
    générique pour les routes mutantes portant un `:id` (update classique **et** transitions
    métier type `POST /:id/approve`, la majorité des transitions du projet étant des `POST`).
  - `AuthzAuditFilter` (global, `@Catch(ForbiddenException, UnauthorizedException)`) : capture les
    rejets 401/403 des Guards, qui n'atteignent jamais un interceptor (Guards avant Interceptors
    dans le cycle de vie Nest).
  - `AuthService` (login/logout) : acteur non résolu à l'appel de login (pas encore authentifié) et
    logout `@Public()` (pas de guard) — audité manuellement avec l'acteur correct une fois connu.
- **Redaction** : `sanitizeAuditValue()` remplace toute clé correspondant à
  `/password|token|secret/i` par `"[redacted]"` dans `before`/`after`, après un aller-retour
  `JSON.parse(JSON.stringify(...))` (nécessaire pour que `Date`/`Decimal` se sérialisent
  correctement plutôt qu'en `{}`).
- **UI** (`apps/web/src/features/audit-logs`) : pagination serveur, filtres (recherche libre,
  utilisateur, action, module/ressource, département, hôtel pour un demandeur org-wide, dates),
  volet détail avec JSON avant/après. Gardée par `audit-logs.view`. Endpoint détail
  (`GET /audit-logs/:id`) vérifie le scope via `assertInScope` avant de renvoyer `before`/`after` —
  jamais inclus dans la liste paginée pour ne pas alourdir un écran à fort volume.

## 3. Authentification

### Sessions et tokens

- Deux secrets JWT distincts : `JWT_ACCESS_SECRET` (courte durée, `JWT_ACCESS_EXPIRES_IN`,
  15 min par défaut) et `JWT_REFRESH_SECRET` (longue durée, `JWT_REFRESH_EXPIRES_IN`, 7 jours par
  défaut) — un refresh token ne peut jamais être accepté comme access token et inversement
  (signature invalide avec le mauvais secret, vérifié par
  `apps/api/test/security-hardening.e2e-spec.ts`).
- **Rotation + détection de réutilisation** : chaque `POST /auth/refresh` révoque l'ancien refresh
  token et en émet un nouveau. Si un refresh token déjà révoqué est présenté à nouveau, c'est un
  signal de vol potentiel — **mais uniquement si la révocation provient d'une rotation**
  (`RefreshToken.revokedReason === "rotated"`). Les révocations bénignes (déconnexion, révocation
  explicite d'une session par son propriétaire, reset de mot de passe) sont taguées différemment et
  ne déclenchent jamais la cascade de révocation globale — un bug réel de faux-positif a été
  corrigé en direct pendant Étape 7 (voir `auth.service.ts`, `refreshTokens()`).
- **Gestion des sessions** (`/auth/sessions`) : liste des sessions actives avec métadonnées
  (user-agent, IP, date), révocation individuelle (jamais celle d'un autre utilisateur — 404, pas
  403, pour ne pas confirmer l'existence d'une session), et "déconnecter partout".

### Réinitialisation de mot de passe

- `POST /auth/password-reset/request` → réponse générique identique que l'email existe ou non
  (anti-énumération), throttlé à 3/60s. Token brut (32 octets aléatoires, `randomBytes`) haché
  SHA-256 avant stockage (`PasswordResetToken.tokenHash`), expire après 30 min, usage unique
  (`usedAt`).
- **Envoi email réel via `EmailProvider`** (abstraction, même pattern que `LLMProvider`/
  `StorageProvider`) : `BrevoProvider` est la seule implémentation réelle, sélectionnée par
  `EMAIL_PROVIDER` (défaut `brevo`). Sans `BREVO_API_KEY`/`EMAIL_FROM_ADDRESS` configurées
  (`isConfigured()` faux), le lien reste écrit dans les logs serveur via le `PinoLogger` injecté —
  **jamais retourné dans la réponse HTTP** dans un cas comme dans l'autre. Envoi best-effort :
  un échec du fournisseur (quota, panne réseau) ne fait jamais échouer la requête ni fuiter
  d'information supplémentaire (même réponse générique). Voir `password-reset.service.ts`,
  `modules/email/`, et `docs/deployment/render.md` (marche à suivre Brevo, sans nom de domaine).
- Un reset réussi révoque **toutes** les sessions actives de l'utilisateur (`revokedReason:
  "password-reset"`) — si l'ancien mot de passe a fuité, les sessions ouvertes avec lui ne doivent
  pas survivre à la réinitialisation.

### 2FA (TOTP)

- `otpauth` (RFC 6238), secret par utilisateur (`User.twoFactorSecret`, jamais exposé par
  `UserResponse`). `enable` exige la vérification d'un vrai code TOTP avant activation (pas de
  fenêtre où 2FA serait "à moitié" actif).
- 8 codes de récupération à usage unique par activation, hachés (SHA-256) et stockés
  individuellement (`TwoFactorRecoveryCode`) — jamais en clair après génération.
- Une fois activé, `login` renvoie un `challengeToken` (5 min, secret dédié
  `JWT_2FA_CHALLENGE_SECRET`, distinct des secrets access/refresh) au lieu des tokens finaux ;
  `POST /auth/2fa/verify` échange ce challenge contre les vrais tokens après validation du code (ou
  d'un code de récupération, consommé à l'usage).
- `disable` exige le mot de passe courant (bcrypt) en plus de l'authentification — désactiver 2FA
  ne doit jamais être possible sur une simple session volée sans le mot de passe.

## 4. Gestion documentaire (upload sécurisé)

- Types acceptés : PDF, JPEG, PNG, WEBP uniquement (`ALLOWED_MIME_TYPES`,
  `documents.service.ts`) — liste blanche stricte sur le MIME type détecté, pas sur l'extension du
  nom de fichier fourni par le client (jamais fiable). Taille max : 10 Mo.
- **`storageKey` toujours aléatoire** (`randomUUID()`), jamais dérivé du nom de fichier original —
  élimine structurellement toute traversée de répertoire, indépendamment de la sanitation du nom
  affiché (`sanitizeFilename()`, qui neutralise en plus les séparateurs de chemin dans le nom
  purement informatif conservé en base). Vérifié par
  `apps/api/test/security-hardening.e2e-spec.ts`.
- Association polymorphe à la ressource métier (`resourceType`/`resourceId`, ex.
  `expenses/<id>`), scope vérifié via `assertInScope` sur la ressource parente avant tout accès —
  isolation inter-hôtel testée explicitement (`documents.e2e-spec.ts`).
- Suppression réelle : le fichier disparaît du stockage, pas seulement masqué en base.
- Architecture derrière une interface `StorageProvider` échangeable — implémentation actuelle :
  disque local (`LocalDiskStorageProvider`, dev uniquement, voir Risques résiduels).

## 5. Logging structuré

- `nestjs-pino` + `pino-http` (`apps/api/src/common/logging/logging.module.ts`) remplace le
  logger console par défaut de Nest.
- Corrélation : `x-request-id` réutilisé s'il est fourni par le client, sinon généré, toujours
  échoé sur la réponse.
- Contexte par requête : `userId`/`hotelId`/`organizationId` injectés sur chaque ligne (`null`
  pour une requête anonyme, jamais une erreur).
- **Secrets jamais journalisés** : le serializer de requête personnalisé n'expose que
  `method`/`url` (ni headers, ni corps), et `redact` couvre en plus les chemins connus
  (`req.headers.authorization`, `req.body.password`, `req.body.token`, ...) en profondeur. Seule
  exception délibérée et documentée : le lien de reset de mot de passe (§3), qui journalise le
  token brut tant qu'aucun fournisseur d'email réel n'est branché.
- JSON en production, `pino-pretty` lisible en dev/test.

## 6. Monitoring

- `GET /health` (alias de `/health/ready`, contrat `render.yaml healthCheckPath` inchangé),
  `GET /health/live` (aucune dépendance externe — un process qui tourne mais dont la DB est
  momentanément indisponible ne doit jamais être redémarré sur ce seul signal),
  `GET /health/ready` (vérifie la connectivité DB).
- `GET /health/metrics` (gardée par `system-monitoring.view`, absente du sous-ensemble
  `HOTEL_ADMIN` — donnée plateforme transverse à tous les tenants, pas une ressource
  organisation/hôtel) : uptime, mémoire (rss/heap), requêtes par classe de statut HTTP, taux
  d'erreur 5xx, latence (moyenne/p95 sur une fenêtre glissante bornée à 1000 échantillons). Alimenté
  par un middleware Express (`MetricsMiddleware`), pas un interceptor Nest — s'exécute avant les
  Guards, donc capture aussi les requêtes rejetées en 401/403.

## 7. Limites de débit (throttling)

| Endpoint | Limite |
|---|---|
| `POST /auth/login` | 5 / 60 s |
| `POST /auth/refresh` | 5 / 60 s |
| `POST /auth/logout` | 5 / 60 s |
| `POST /auth/password-reset/request` | 3 / 60 s |
| `POST /auth/password-reset/confirm` | 5 / 60 s |
| `POST /auth/2fa/verify` | 5 / 60 s |
| Tout le reste | 100 / 60 s (défaut global) |

Appliqué réellement en test e2e (aucun bypass environnement) — les suites de test sont écrites en
conséquence (nombre d'appels aux endpoints throttlés compté et commenté dans chaque fichier).

## 9. Nimba AI (IA intégrée)

Document normatif détaillé : `docs/architecture/nimba-ai.md`. Résumé des invariants de sécurité
propres à cette fonctionnalité (constructions Étapes 1-11) :

- **Aucun accès direct à PostgreSQL** : tout accès donnée passe par un Tool → Business Service
  existant, appelé avec le vrai `AuthenticatedUser` — RBAC/scope identiques à l'équivalent REST,
  jamais de logique dupliquée ni contournée.
- **Refus RBAC déterministe avant tout accès donnée** : `AiToolRegistry.invoke()` vérifie TOUTES
  les `requiredPermissions` d'un Tool (AND) avant `execute()` — un refus est audité (`AuditLog`,
  action `tool-denied`), même chemin que `AuthzAuditFilter` pour un 401/403 REST.
- **Aucune permission IA synthétique** : chaque Tool exige exactement la permission réelle qui
  gate déjà l'endpoint REST équivalent (`finance-summary.view`, `payslips.view`, ...) —
  `nimba-ai.use` n'est qu'une porte d'entrée grossière, jamais un substitut au contrôle fin.
- **Minimisation stricte avant tout contexte LLM** : chaque `DataMinimizer` ne garde que les
  agrégats nécessaires (ex. masse salariale → total + nombre de bulletins, jamais de liste
  nominative) ; le message envoyé au LLM après un appel de Tool ne contient jamais
  `context.user`/`permissions`, uniquement `{data, provenance}` déjà minimisées (vérifié par
  `ai-chat.service.spec.ts`).
- **Le LLM ne calcule et ne modifie jamais de donnée métier** : aucun Tool en écriture n'est
  jamais enregistré dans `AiToolRegistry` (surface figée, vérifiée par test —
  `nimba-ai-security.e2e-spec.ts`) ; tous les chiffres affichés par Nimba AI sont produits par les
  mêmes Business Services que l'API REST, jamais recalculés ni inventés par le LLM.
- **Assistant sans clé configurée** : message clair, jamais une erreur 500 ; une erreur du
  fournisseur LLM ne casse jamais Insights/Anomalies déterministes (chemins de code indépendants).
- **`GEMINI_API_KEY` optionnelle et jamais exposée au frontend** — même discipline que les autres
  secrets (§5, jamais journalisée). Substituée par `FakeLLMProvider` dans tous les tests
  automatisés (aucun appel réseau réel à un fournisseur LLM depuis la suite de tests).
- **Aucun Tool n'expose de paramètre `hotelId`** : l'hôtel actif résolu par chaque Tool vient
  exclusivement de `context.user.hotelId` (JWT de la session, jamais un argument choisi par le
  LLM) — une question qui nomme explicitement un autre hôtel ne peut donc structurellement jamais
  faire fuiter les données de cet hôtel, vérifié par test (`nimba-ai-hotel-membership.e2e-spec.ts`).
  Un garde statique (`security-invariants.spec.ts`) empêche en plus tout Tool/Minimizer futur
  d'importer `PrismaService` directement. Détail : `docs/architecture/rbac-multi-hotel.md`.

## 10. Risques résiduels (avant première mise en production réelle)

- **Email réel (Brevo) implémenté mais optionnel — à activer avant tout accès public** : le code
  (`BrevoProvider`, `modules/email/`) et l'UI (`/forgot-password`, `/reset-password`) sont en place
  et testés, mais restent inertes tant que `BREVO_API_KEY`/`EMAIL_FROM_ADDRESS` ne sont pas
  renseignées sur le service Render — sans elles, le reset fonctionne uniquement via lecture des
  logs serveur, inutilisable pour de vrais utilisateurs finaux. Marche à suivre (sans nom de
  domaine) : `docs/deployment/render.md`, étape 6.
- **Stockage local des documents non viable sur Render** : le plan `free` (et la plupart des plans
  Render) ont un système de fichiers **éphémère** — tout document uploadé est perdu au prochain
  redémarrage/redéploiement. `StorageProvider` est conçu pour être remplacé (S3/R2/Cloudinary/...)
  sans toucher `DocumentsService`, mais aucune implémentation cloud n'existe encore.
- **CI ne bloquait pas les déploiements Render** : `render.yaml` redéploie automatiquement à chaque
  push sur `main`, indépendamment du résultat de `.github/workflows/ci.yml` (aucune règle de
  protection de branche configurée côté GitHub).
- **Prisma 5.22** : mise à jour majeure disponible (7.x). Non traitée dans cette phase (risque de
  régression trop large pour un changement non demandé) — à planifier séparément, avec sa propre
  suite de vérification.
- **Chunk frontend > 500 kB** : `apps/web/dist/assets/index-*.js` (~653 kB avant gzip) dépasse le
  seuil d'avertissement Vite. Fonctionnel, mais un code-splitting par route réduirait le temps de
  premier chargement.
- **Nimba AI — conversation sans état côté serveur** : l'historique de l'assistant vit uniquement
  dans le state React du frontend, perdu à la fermeture de l'onglet ; aucun `AiUsageLog` n'est
  encore exploité par un système de quotas (le modèle est alimenté, l'écran de consultation et
  l'application de limites viendront plus tard). Voir `docs/architecture/nimba-ai.md`, section
  "Risques résiduels".
- **`ReportsService.financialReport()` n'applique pas le scope départemental** : contrairement à
  `FinanceSummaryService.getSummary()`, le rapport financier (REST et Tool Nimba AI
  `department-comparison`) ne filtre jamais par les départements assignés au demandeur — un rôle
  scopé à un seul département verrait les lignes de tous les départements de l'hôtel. Aucun des 9
  rôles seedés n'a de `UserDepartment` assigné aujourd'hui (le cas ne s'est jamais présenté en
  pratique), mais mérite une décision produit avant qu'un rôle département-scopé n'utilise ce
  rapport. Voir `docs/architecture/rbac-multi-hotel.md`.
- **Aucune garde de permission au niveau du routeur frontend** : `RequireAuth` ne vérifie que
  l'authentification, jamais la permission — une route dont l'entrée de nav est masquée reste
  directement navigable par URL (la page affiche sa coquille, jamais de donnée, puisque les hooks
  de données restent gardés côté backend). Pas une fuite de donnée constatée, mais une garde de
  redirection par route serait un changement de comportement UX à valider avec le produit. Voir
  `docs/architecture/rbac-multi-hotel.md`.

## Voir aussi

- `docs/architecture/rbac-multi-hotel.md` — `HotelMembership`, `switch-hotel`, 9 rôles métier,
  `HotelSwitcher` frontend (§1 ci-dessus en est le résumé RBAC, §9 le résumé Nimba AI).
- `docs/architecture/email-delivery.md` — `EmailProvider`/`BrevoProvider`, pages `/forgot-password`
  et `/reset-password` (§3 ci-dessus en est le résumé sécurité).
- `docs/architecture/access-matrix.md` — matrice d'accès complète (profil → module → sous-module →
  route → permission), générée depuis le catalogue et le seed réels.
- `docs/architecture/frontend-routes.md` — routes frontend vérifiées et visibilité nav par profil.
- `docs/architecture/nimba-ai.md` — architecture détaillée de Nimba AI (§9 ci-dessus en est le
  résumé sécurité).
- `docs/architecture/testing.md` — fondation de tests, principe "vraie base, pas de mocks".
- `docs/deployment/render.md` — déploiement, variables d'environnement, limites connues du plan
  `free`.
- `docs/business-rules/finance.md` — règles métier financières (hors périmètre sécurité).
