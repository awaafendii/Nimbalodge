# Phase 12 — Notifications + audit trail

Introduit `Notification` (§35, in-app) et `AuditLog` (§37, écrit par un `AuditInterceptor` global —
annoncé dès `docs/architecture/phase-2-backend-foundations.md` : "un interceptor d'audit qu'à
partir de la Phase 12", donc la première utilisation réelle de `apps/api/src/common/interceptors/`).
Étend aussi `BudgetsService` (Phase 5) avec `checkOverspendAlerts()` — "alertes de dépassement
budgétaire", explicitement prévu pour cette phase dans `docs/architecture/phase-5-finance.md`
("données déjà interrogeables").

## `Notification` — la seule entité du projet isolée par utilisateur, pas par hôtel

Partout ailleurs, `list()` dérive son scope de `requester.hotelId`/`organizationId`. Ici,
`NotificationsService.list()` ne regarde QUE `userId: requester.id` — même SUPER_ADMIN ne voit que
ses propres notifications, jamais celles des autres. C'est la sémantique même d'une notification
(un message adressé), pas une omission du pattern d'isolation habituel. Vérifié en base réelle :
HOTEL_ADMIN qui tente `POST /notifications/:id/read` sur une notification de SUPER_ADMIN → `403`.

`type`/`relatedType` en texte libre (comme `Reservation.source`). `relatedType`+`relatedId`
réfèrent l'entité déclenchante EN CLAIR, jamais une vraie FK polymorphe (le type de cible varie,
aucune contrainte DB possible) — utilisés uniquement pour la déduplication (voir plus bas).

**Canal "push" (§35) hors périmètre** : nécessite un fournisseur externe (FCM/APNs), aucun
identifiant/décision d'infrastructure fournie. Seul le stockage/consultation in-app est implémenté.
Pas d'endpoint `POST /notifications` public : cette phase ne construit aucune messagerie manuelle
(un admin qui écrit à un autre utilisateur) — uniquement des notifications générées en interne par
un déclencheur système (le dépassement budgétaire, premier et seul cette phase). Un futur
déclencheur pourra réutiliser `NotificationsService.notifyUsersWithPermission()` sans modification.

## `NotificationsService.notifyUsersWithPermission()` — fan-out + déduplication réutilisables

Résout les destinataires en interrogeant directement `User → UserRole → Role → RolePermission →
Permission` (même traversée que `PermissionsService.resolveForUser()`, Phase 3, mais inversée :
"qui a cette permission" plutôt que "quelles permissions a cet utilisateur"). Portée : les
utilisateurs actifs de l'hôtel concerné **+ les utilisateurs org-wide** (`hotelId: null`, ex.
SUPER_ADMIN) de la même organisation — un dépassement budgétaire dans un hôtel doit remonter à qui
supervise l'ensemble. Vérifié en base réelle : 2 destinataires notifiés (SUPER_ADMIN org-wide +
HOTEL_ADMIN de l'hôtel), tous deux détenteurs de `finance.budget.view`.

Déduplication : si une notification existe déjà pour la paire `relatedType`+`relatedId`, aucune
nouvelle n'est créée — un dépassement donné n'alerte qu'une fois, même si la fonction est rappelée
(vérifié : 2 appels successifs de `check-overspend`, `notificationsCreated` passe de 2 à 0).
**Limite documentée** : pas de ré-alerte si le dépassement s'aggrave après coup (l'alerte reste
"une fois pour toutes" par ligne).

## `BudgetsService.checkOverspendAlerts()` — déclenchement à la demande, pas de scheduler

Aucune infrastructure cron/scheduler n'existe dans ce projet (rien d'asynchrone/planifié nulle
part) — en ajouter une pour cette seule fonctionnalité serait de l'infrastructure nouvelle non
demandée. `POST /budgets/:id/check-overspend` réutilise `getExecution()` (Phase 5) telle quelle,
sans rien recalculer en dur ; un futur scheduler externe (hors périmètre du code applicatif)
pourrait l'appeler périodiquement. Seules les lignes `EXPENSE` comptent — un dépassement `REVENUE`
est une bonne nouvelle, pas une alerte.

## `AuditLog` — champs organizationId/hotelId/userId LIBRES, sans FK

Déviation assumée du reste du schéma (partout ailleurs : FK réelle + `onDelete` explicite). Un
journal d'audit doit survivre à la suppression future de ce qu'il référence — jamais bloqué
(`Restrict`) ni vidé (`SetNull`/`Cascade`) par elle. Ces champs sont capturés en clair au moment de
l'écriture, depuis `request.user` (peut être absent — ex. tentative de login échouée avant
authentification, capturée quand même avec `userId: null`).

## `AuditInterceptor` — seules les requêtes mutantes, pas de code HTTP exact, best-effort

`common/interceptors/audit.interceptor.ts`, enregistré globalement (`APP_INTERCEPTOR`, même
mécanisme que `ThrottlerGuard`/`APP_GUARD`, Phase 3). Journalise uniquement POST/PATCH/PUT/DELETE —
les GET ne le sont pas (volume, pratique standard d'un journal "qui a changé quoi").

`outcome` (`SUCCESS`/`FAILURE`) plutôt qu'un code HTTP précis : lire `response.statusCode` dans le
`tap()` d'un interceptor est fragile (Nest fixe le code final APRÈS la résolution complète de la
chaîne d'interceptors, pas pendant) — un simple succès/échec (déterminé par la présence ou non d'une
erreur dans l'Observable) est fiable et suffisant pour un "audit trail" minimal, non demandé plus
précis au brief. Vérifié en base réelle : une transition invalide (`submit` sur une dépense déjà
`PAID`, `400`) produit bien une entrée `FAILURE` (`errorMessage` capturé, tronqué à 500 caractères).

**Pas de corps de requête/réponse stocké** — évite de journaliser des données sensibles (ex. un mot
de passe sur `POST /auth/login`), juste method/path/acteur/résultat. Écriture **best-effort**
(`.catch(() => undefined)`, jamais attendue par la requête réelle) : un échec d'écriture du log ne
doit jamais faire échouer l'action métier elle-même.

**Limite documentée** : les rejets `401`/`403` (levés par les Guards) n'atteignent jamais
l'interceptor — dans le cycle de vie Nest, les Guards s'exécutent AVANT les interceptors ; une
requête bloquée par `JwtAuthGuard`/`PermissionsGuard` ne génère aucune entrée d'audit. Pas un oubli,
un choix d'architecture Nest standard.

## `GET /audit-logs` — seule liste du projet avec une limite (`take: 200`)

Contrairement à tout le reste (pas de pagination, volume "métier" limité), `AuditLog` grandit au
rythme des requêtes HTTP mutantes, pas des actions humaines — une limite est nécessaire dès cette
phase. Filtres `userId`/`resourceType`/`dateFrom`/`dateTo` permettent de cibler au-delà des 200 plus
récents. Scope : `organizationId`/`hotelId` filtrés directement sur les scalaires libres de
`AuditLog` (pas via le pattern `hotel: {organizationId}` habituel, qui suppose une vraie relation).

## Permissions

`notifications.view`/`notifications.mark-read` (self-scopées, aucune notion d'hôtel/organisation
dans la logique elle-même — la permission gate juste l'accès à la fonctionnalité) ;
`audit-logs.view` ; `finance.budget.check-overspend` (format imbriqué, cohérent `finance.*`).
HOTEL_ADMIN reçoit tout — notifications/audit sont déjà scopés par utilisateur/hôtel, et
`check-overspend` ne déplace pas d'argent (contrairement à `finance.expense.book`), aucun contrôle
org-level identifié.

## Vérification en base réelle

1. Migration (contournement Windows établi Phase 6) → `prisma generate` → `npm run build:api`
   (voir note `tsconfig.tsbuildinfo`, Phase 10) → `npm run db:seed` → `node apps/api/dist/main.js`.
2. Budget + ligne EXPENSE (planned 100000) → dépense payée 200000 dans la même catégorie.
3. `POST /budgets/:id/check-overspend` → `overspentLineCount=1`, `notificationsCreated=2`
   (SUPER_ADMIN org-wide + HOTEL_ADMIN, tous deux `finance.budget.view`).
4. Rappel immédiat → `notificationsCreated=0` (déduplication).
5. `GET /notifications` (HOTEL_ADMIN) → la notification `budget_overspend` présente.
6. `POST /notifications/:id/read` → `isRead=true`, `readAt` renseigné ; `?unreadOnly=true` → vide
   ensuite.
7. HOTEL_ADMIN sur la notification de SUPER_ADMIN → `403`.
8. `GET /audit-logs?resourceType=expenses` → 4 entrées `SUCCESS` (create/submit/approve/mark-paid).
9. `submit` sur une dépense déjà `PAID` → `400` métier + nouvelle entrée `AuditLog` `FAILURE`.
10. `401` sans token sur `/notifications` et `/audit-logs`.
11. `npm run typecheck` (aucune régression `apps/web`/`nimbalodge-app`).

## Périmètre exclu

Canal de notification "push" (FCM/APNs, fournisseur externe non choisi) ; `POST /notifications`
manuel/broadcast (seul un déclencheur système — le dépassement budgétaire — crée des notifications
cette phase) ; ré-alerte si un dépassement déjà notifié s'aggrave ; scheduler/cron pour appeler
`check-overspend` automatiquement (déclenchement à la demande uniquement) ; capture du corps de
requête/réponse dans `AuditLog` ; capture des rejets `401`/`403` (Guards, hors de portée de
l'interceptor) ; pagination de `GET /audit-logs` au-delà de la limite `take: 200` + filtres ;
connexion frontend↔backend.
