# Étape 7 — Durcissement Production Readiness

Vue d'ensemble structurelle des modules ajoutés pendant cette phase (dix priorités, chacune
committée séparément — voir l'historique git pour le détail incrémental). Pour le comportement de
sécurité/authentification/audit/uploads/logging/monitoring, voir `docs/security/overview.md` —
document normatif, celui-ci est un index de "où vit quoi".

## Nouveaux modules backend

| Module | Fichiers clés | Rôle |
|---|---|---|
| `common/logging` | `logging.module.ts` | Bootstrap `nestjs-pino`, remplace le logger Nest par défaut. `@Global()`, importé une fois dans `AppModule`. |
| `common/monitoring` | `metrics.service.ts`, `metrics.middleware.ts`, `monitoring.module.ts` | Compteurs en mémoire (requêtes/latence/erreurs), alimentés par un middleware Express (pas un interceptor — capture aussi les rejets de Guard). `@Global()`. |
| `modules/documents` | `documents.service.ts`, `documents.controller.ts`, `documents.module.ts`, `storage/` | Upload sécurisé, association polymorphe `resourceType`/`resourceId`, interface `StorageProvider` échangeable. |
| `modules/auth` (extension) | `password-reset.service/controller.ts`, `two-factor.service/controller.ts`, `sessions.service/controller.ts` | Password reset, 2FA TOTP, gestion de sessions — s'ajoutent à `auth.service.ts`/`auth.controller.ts` existants. |
| `modules/health` (extension) | `health.controller.ts` (routes `live`/`ready`/`metrics` ajoutées à l'existant `check()`) | Liveness/readiness distincts + métriques. |
| `modules/audit-logs` (extension) | `audit-logs.service.ts` (pagination serveur, filtres, détail) | Existait déjà (Phase 12), entièrement réécrit pour la pagination/le filtrage server-side. |

## Nouveaux modules frontend

| Module | Fichiers clés | Rôle |
|---|---|---|
| `features/audit-logs` | `index.tsx` | Écran dédié (déplacé hors de `features/notifications`), pagination/filtres/recherche serveur, volet détail before/after. |
| `packages/ui` `data-table.tsx` | props `serverPagination`/`serverSearch` | Extension opt-in du composant `DataTable` partagé — mode serveur pour AuditLog, aucun changement pour les ~14 autres écrans en mode client. |
| `hooks/services` `users.ts` | `use-users.ts`, `services/users.ts` | Liste minimaliste d'utilisateurs pour alimenter le filtre "Utilisateur" de l'écran Audit — best-effort, ne casse jamais l'écran si absent. |

## Nouvelle infrastructure RBAC

- `system-monitoring.view` : permission ajoutée au catalogue (`prisma/permissions-catalog.ts`),
  réservée à `SUPER_ADMIN` (absente du sous-ensemble `HOTEL_ADMIN` de `seed.ts`) — première
  permission du catalogue à ne pas être une ressource organisation/hôtel/département mais une
  donnée plateforme transverse.

## Décisions d'architecture notables

- **Middleware Express plutôt qu'interceptor Nest pour les métriques** : un `APP_INTERCEPTOR`
  s'exécute après les Guards et ne verrait jamais les requêtes rejetées en 401/403 — un middleware
  Express s'exécute avant le routing Nest, capture tout.
- **`DataTable` étendu plutôt que dupliqué** : `serverPagination`/`serverSearch` sont des props
  optionnelles ; en leur absence, le comportement client historique (tri/recherche/pagination
  entièrement locaux) est inchangé pour tous les écrans existants. Un seul fichier à faire évoluer
  si un futur écran a besoin du même mode.
- **`PinoLogger` injecté plutôt que `Logger` de Nest** dans les services qui ont besoin de
  contrôler explicitement le contenu d'un log (ex. le lien de reset de mot de passe) — `Logger` de
  Nest reste utilisé ailleurs (ex. `HealthService`) et est automatiquement redirigé vers `pino` par
  `app.useLogger(app.get(Logger))` dans `main.ts`, donc aucune migration mécanique n'était
  nécessaire pour les usages qui n'ont pas besoin de ce contrôle fin.

## Voir aussi

- `docs/security/overview.md` — comportement de sécurité normatif.
- `docs/production-readiness-report.md` — rapport de synthèse (tests, dette technique, risques
  résiduels, recommandations avant mise en production).
- `docs/deployment/render.md` — déploiement, limites connues.
