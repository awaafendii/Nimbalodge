# Rapport Production Readiness — Étape 7 (Durcissement)

Date : voir le dernier commit d'Étape 7 sur `main`. Périmètre : NestJS/Prisma/PostgreSQL (backend),
React/Vite/PWA (frontend), déployés sur Render. Ce rapport clôt la phase "Durcissement production
restant" demandée avant Nimba AI — dix priorités traitées séquentiellement, chacune avec inspection
du code existant, implémentation, tests (unitaires + e2e + vérification live), et commit dédié.

## 1. Sécurité — synthèse

Voir `docs/security/overview.md` pour le détail normatif. Points clés :

- RBAC fail-closed (une route sans permission/garde explicite est refusée par défaut, jamais
  autorisée par omission).
- Isolation multi-tenant (organisation → hôtel → département) appliquée par des fonctions pures
  réutilisées (`assertInScope`/`assertInDepartmentScope`), testée pour ~10 modules métier distincts.
- Audit trail complet (before/after, acteur, scope, action, timestamp) sur toute mutation, y
  compris les rejets d'autorisation (401/403) et les événements auth (login/logout).
- Secrets JWT séparés par usage (access/refresh/2FA challenge) — aucune confusion possible entre
  eux, vérifié par test.
- Aucun secret commité (historique git vérifié), `.gitignore` correct, scan de code source sans
  résultat hors fixtures de test déjà documentées.
- Injection : requêtes Prisma paramétrées par construction (pas de SQL brut sur entrée
  utilisateur), vérifié explicitement (payloads d'injection SQL en entrée, table intacte ensuite).
- Traversée de chemin : structurellement impossible sur les uploads (clé de stockage toujours
  aléatoire, jamais dérivée du nom de fichier).

## 2. Authentification

Password reset (token à usage unique, expiration 30 min, anti-énumération), 2FA TOTP (avec codes
de récupération à usage unique), gestion de sessions (révocation individuelle ou globale, jamais
celle d'un autre utilisateur), rotation de refresh token avec détection de réutilisation (faux
positif de cascade corrigé en cours de phase — voir `docs/security/overview.md` §3). Un point
produit reste ouvert : **aucun envoi d'email réel** (voir Risques résiduels).

## 3. RBAC & Multi-tenancy

Catalogue de permissions uniformisé (`resource.action`), cohérence frontend/backend vérifiée
bouton par bouton pour les modules Finance et RH/Paie. Scopes organisation/hôtel/département
appliqués de façon cohérente, y compris pour les nouveaux endpoints ajoutés cette phase
(`/health/metrics`, `/audit-logs/:id`).

## 4. Audit

`AuditLog` capture CREATE/UPDATE/DELETE/APPROVE/REJECT/PAY/BOOK/CANCEL/LOGIN/LOGOUT et les rejets
d'autorisation, avec acteur/organisation/hôtel/département/ressource/action/timestamp et
before/after (jamais de secret dans ces snapshots — redaction par motif de clé). UI dédiée
(`/audit-logs`) : pagination serveur réelle, filtres multiples, recherche, volet détail. Écriture
best-effort (jamais bloquante pour la requête réelle) — propriété assumée, documentée, et prise en
compte dans les tests qui en dépendent.

## 5. Uploads (gestion documentaire)

Liste blanche MIME stricte (PDF/JPEG/PNG/WEBP), taille max 10 Mo, noms de fichiers assainis,
stockage par clé aléatoire (jamais dérivée du nom original), scope vérifié avant tout accès,
suppression réelle. Architecture derrière une interface `StorageProvider` échangeable — seule
implémentation actuelle : disque local, **non viable sur le système de fichiers éphémère de
Render** (voir Risques résiduels).

## 6. Logging

Migration complète de `console.log`/Logger par défaut vers `pino` structuré : corrélation par
requête, contexte utilisateur/hôtel/organisation, secrets jamais journalisés (serializer minimal +
redaction en profondeur), JSON en production / lisible en dev. Une seule exception délibérée et
documentée (lien de reset de mot de passe, tant qu'aucun email réel n'est branché).

## 7. Monitoring

Liveness/readiness distincts (`/health/live`, `/health/ready`, `/health` conservé en alias pour ne
pas casser le contrat `render.yaml`), endpoint de métriques opérationnelles
(`/health/metrics`, gardé par une permission dédiée réservée à `SUPER_ADMIN`) : uptime, mémoire,
volumétrie/latence des requêtes par classe de statut HTTP, taux d'erreur 5xx.

## 8. Tests

- **109 tests automatisés** au total : 40 unitaires (`test:api:unit`, logique métier isolée,
  mocks manuels) + 69 e2e (`test:api:e2e`, vraie base PostgreSQL de test, `AppModule` complet avec
  tous les guards/interceptors actifs, aucun mock de Prisma/Auth).
- Zéro test avant Étape 2 (Master Prompt V2) — fondation posée alors, considérablement étendue
  cette phase (password reset, 2FA, sessions, uploads, logging, monitoring, audit-logs paginé,
  injection/token expiré).
- CI (`.github/workflows/ci.yml`) exécute typecheck + build + tests unitaires + tests e2e sur
  chaque push/PR vers `main` — un oubli de variable d'environnement (`JWT_2FA_CHALLENGE_SECRET`)
  qui empêchait l'étape e2e de démarrer l'application a été corrigé cette phase (voir Priority 9),
  ainsi que l'absence de l'étape "tests unitaires" (CI ne lançait jusqu'ici que les e2e).
- **CI ne bloque pas le déploiement Render** (pas de règle de protection de branche côté GitHub) —
  voir Dette technique.

## 9. Frontend

Tous les modules cibles ont un écran réel branché sur l'API (plus de composant `ComingSoon` —
supprimé cette phase, code mort depuis que le dernier module a été branché). Nouvel écran Audit
dédié avec pagination serveur, filtres, et volet détail before/after — a nécessité une extension
du composant `DataTable` partagé (mode serveur opt-in, sans changement pour les ~14 autres écrans
qui restent en pagination client). Bug de perte de focus sur un champ de recherche server-driven
trouvé et corrigé en testant en direct dans Chrome (`placeholderData: keepPreviousData`, TanStack
Query v5).

## 10. Backend

NestJS modulaire, ~50 modules métier + infrastructure transverse (audit, permissions, logging,
monitoring, documents). Build de production (`build:api`) et script de bootstrap production
(`build:bootstrap`) vérifiés propres. 17 migrations Prisma appliquées, aucune dérive détectée.

## 11. PWA / Offline (Étape 6, hors périmètre direct de cette phase mais vérifié compatible)

File de mutations + moteur de synchronisation (`apps/web/src/offline/mutation-queue.ts`),
persistance IndexedDB + TanStack Query, panneau des opérations en attente isolé par utilisateur.
`networkMode: "always"` sur les mutations (piège TanStack Query v5 documenté en mémoire de
session : le mode `"online"` par défaut suspend silencieusement les mutations hors ligne). Non
retouché cette phase — les changements de logging/monitoring/audit n'interfèrent pas avec ce
mécanisme (vérifié par la suite e2e complète, qui couvre des mutations HTTP standard).

## 12. Dette technique restante

- Chunk JS principal du frontend > 500 kB après minification (pas de code-splitting par route).
- Prisma 5.22, une mise à jour majeure (7.x) disponible — non traitée (hors périmètre d'un
  durcissement, risque de régression à isoler dans son propre changement).
- CI ne bloque pas les déploiements Render (déploiement automatique à chaque push sur `main`,
  indépendant du résultat CI) — décision à prendre séparément (règle de protection de branche
  GitHub).
- Aucun test de charge/performance n'a été effectué — les métriques `/health/metrics` donnent une
  visibilité de base (latence p95, taux d'erreur) mais aucun seuil d'alerte n'est configuré (pas
  d'intégration Grafana/Datadog/PagerDuty).

## 13. Risques résiduels avant première mise en production réelle

1. **Aucun envoi d'email réel** — reset de mot de passe inutilisable pour de vrais utilisateurs
   finaux tant qu'un fournisseur (Resend/SendGrid/...) n'est pas branché à
   `PasswordResetService.requestReset()`.
2. **Stockage de documents non persistant sur Render** — tout document uploadé est perdu au
   prochain redémarrage/redéploiement (système de fichiers éphémère). Remplacer
   `LocalDiskStorageProvider` par une implémentation cloud (S3/R2/...) avant d'exposer ce
   déploiement à de vrais utilisateurs qui uploadent des documents réels.
3. **Plan Render `free`** — la base de données expire après 90 jours d'inactivité du plan, et le
   service se met en veille (cold start ~30-60s). Passer sur un plan payant avant toute donnée
   réelle destinée à durer.
4. **CI non bloquante** — un commit cassant les tests peut atteindre la production sans
   intervention manuelle.

## 14. Recommandations avant première mise en production

Par ordre de priorité :

1. Brancher un fournisseur d'email réel pour le reset de mot de passe (bloquant pour tout
   utilisateur réel qui oublie son mot de passe).
2. Brancher un `StorageProvider` cloud pour les documents (bloquant dès le premier upload réel
   destiné à durer).
3. Passer la base de données Render sur un plan payant si le déploiement doit durer > 90 jours.
4. Configurer une règle de protection de branche GitHub pour que la CI bloque un déploiement
   cassé.
5. (Optionnel, non bloquant) Code-splitting frontend par route, mise à jour Prisma majeure planifiée
   séparément, intégration d'un outil d'alerting sur les métriques `/health/metrics`.

Sous réserve des points 1 à 3 ci-dessus (tous déjà identifiés et documentés, aucun n'est une
découverte de dernière minute), l'application est considérée prête pour une mise en production
réelle du point de vue sécurité/authentification/RBAC/audit/logging/monitoring/tests — le
périmètre couvert par cette phase de durcissement.
