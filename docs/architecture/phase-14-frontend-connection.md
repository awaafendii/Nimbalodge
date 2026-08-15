# Phase 14 — Connexion frontend↔backend (fondation + modules de référence)

Première phase sans README de module ni référence croisée annonçant son périmètre — toutes les
features nommées de `apps/web/src/features/` avaient déjà leur backend (Phases 4-13). Périmètre
choisi directement avec l'utilisateur : brancher `apps/web` sur l'API réelle, sous la directive
produit explicite "NimbaLodge n'est pas un prototype" (voir mémoire `feedback_production_not_prototype`)
— aucune donnée fictive, aucun défaut imposé, le backend reste l'unique source de vérité.

Périmètre livré : fondation complète (auth, client API, garde de route, nav filtrée par permission,
états zéro/chargement/erreur/permission/offline/sync) + trois modules entièrement branchés comme
référence (Tableau de bord, Paramètres/Départements, Finance) ; les onze modules restants gardent
`ComingSoon`, dont le texte a été corrigé (il annonçait "backend manquant", ce qui n'est plus vrai
depuis la Phase 4).

## Aucune donnée fabriquée — zéro exception

Conformément à la directive produit, aucun `mockData`/`fakeData`/`dummyData` n'a été introduit.
Le Tableau de bord (`GET /finance/summary`), Paramètres (`GET /hotels/:id`, `GET /departments`) et
Finance (`GET /revenues`, `GET /expenses`, `GET /financial-categories`, `GET /cash-accounts`)
consomment tous l'API réelle. Vérifié en navigateur réel (Chrome, pas une simulation) : les données
affichées sont exactement celles accumulées par les sessions de vérification des Phases 5-13
(recettes/dépenses/départements de test créés via `curl` dans ces phases) — pas une seule valeur
n'est écrite en dur dans le code frontend.

## Authentification — JWT + refresh, aucun bypass client

`stores/auth-store.ts` (Zustand + persist) stocke `accessToken`/`refreshToken`/`user` (reflet exact
de `GET /auth/me`). `services/api-client.ts` attache le token à chaque requête, et sur un `401`
tente **un seul** refresh (mutex partagé entre requêtes concurrentes via une promesse commune) avant
de rejouer la requête ; si le refresh échoue, la session est purgée. `hasPermission()` ne fait
**aucun bypass** pour SUPER_ADMIN — la permission doit être explicitement présente dans la liste
résolue par le backend (RBAC réel, Phase 3), jamais simulée côté client.

`RequireAuth` (route guard) revalide via `GET /auth/me` à chaque montage (staleTime 5 min) : un
token présent en storage mais révoqué còté serveur redirige vers `/login` au lieu d'afficher un
shell vide. Vérifié en navigateur : visite non authentifiée de `/` → redirection `/login` ;
connexion HOTEL_ADMIN → Tableau de bord ; déconnexion → retour `/login`, token purgé.

## Nav filtrée par permission réelle, pas simulée

`nav-config.tsx` associe à chaque module une permission représentative (`finance.summary.view`,
`employees.view`, `products.view`, ...). `Sidebar` masque les entrées dont la permission manque —
vérifié avec HOTEL_ADMIN (toutes les entrées visibles, rôle seed avec quasi-toutes les permissions)
et SUPER_ADMIN (vue organisation, "aucun hôtel unique sélectionné" au lieu d'un hôtel fictif).
**Les hooks de données eux-mêmes ne dupliquent pas cette logique** (pas de `enabled:
hasPermission(...)` sur les query hooks) : un `403` réel remonté par le backend est géré par
`QueryState`, le serveur reste l'unique autorité, la nav ne fait que filtrer la découvrabilité.

## `QueryState` — les 4 états explicites exigés par la directive produit

Composant générique (`components/common/query-state.tsx`) : `isLoading` → squelette (personnalisable
via `renderLoading`, ex. grille de KPI plutôt que lignes empilées) ; `error` → carte d'erreur avec
bouton "Réessayer", ou message "Accès non autorisé" dédié si `ApiError.status === 403` ; données
vides (`isEmpty`) → carte avec message + action ("Aucun département configuré" + bouton "Ajouter un
département", jamais une liste fictive) ; sinon rendu réel. L'état "offline" est géré globalement
(`OfflineBanner` + `useOnlineStatus`, propriété de l'appareil, pas d'un écran) ; l'état
"synchronisation" par un indicateur discret dans `Topbar` (`useIsFetching()`) plutôt qu'une file
d'attente offline-first — aucune infrastructure de synchronisation locale n'existe dans ce projet,
inventer une queue offline complète aurait été hors périmètre pour cette phase.

## Départements — reflet direct de "aucun défaut imposé"

`Settings` liste/crée/désactive des départements réels. Vérifié explicitement contre la directive
produit : `HotelsService.create()` (Phase 4, inchangé) n'impose aucun département — le champ
`createDefaultDepartment` est une case à cocher explicite (§48 du brief), jamais un comportement
caché. Le formulaire de création ne montre un sélecteur d'hôtel que pour un demandeur org-wide
(`!user.hotel`) — vérifié avec les deux rôles seed : HOTEL_ADMIN (pas de sélecteur, hôtel dérivé),
SUPER_ADMIN (sélecteur affiché, alimenté par `GET /hotels`).

## Finance — module de référence pour un workflow à statuts

Recettes (liste + création) et Dépenses (liste + création + `Soumettre`/`Approuver`/`Marquer payée`,
un bouton par statut courant, jamais un `PATCH` générique — même contrat que l'API, Phase 5) montrent
le patron complet pour un futur module avec cycle de vie. Formulaires de création dégradent
explicitement si aucune catégorie/caisse n'existe encore ("Configurez-en une... avant de saisir")
plutôt que d'afficher un select vide silencieux. Vérifié en navigateur réel : transition Brouillon →
En attente → bouton "Approuver" apparaît immédiatement (invalidation React Query ciblée), aucune
régression.

## Design system — deux primitives ajoutées, pas plus

`Input`/`Label` ajoutés à `packages/ui` (aucun composant de formulaire n'existait avant cette phase).
Pas de composant `Table`/`Select`/`Alert` dédié : les listes utilisent des `<ul>`/`<li>` stylées, les
select des `<select>` HTML natifs stylés inline — cohérent avec le volume d'écrans réellement
construits cette phase (3), un abstraction `Select`/`Table` réutilisable sera justifiée quand un
4ᵉ ou 5ᵉ module en aura réellement besoin, pas par anticipation.

## Vérification — navigateur réel, pas une simulation

`npm run typecheck` (les 4 workspaces) → `npm run build:web` (build de production, aucune erreur) →
API + `vite dev` démarrés → Chrome (via l'outil `claude-in-chrome`, pas une capture statique) :
connexion HOTEL_ADMIN → Tableau de bord (chiffres réels) → Paramètres (hôtel réel + départements
réels, création réelle vérifiée par réapparition dans la liste, désactivation réelle vérifiée par le
badge) → Finance (recettes/dépenses réelles, transition de statut réelle) → déconnexion → `/login`.
Reconnexion SUPER_ADMIN → vue organisation, sélecteur d'hôtel dans le formulaire. Console navigateur
inspectée : aucune erreur, un seul avertissement bénin préexistant (React Router, sans rapport).

## Périmètre exclu

Les onze modules restants (Réservations, Chambres, Clients, RH, Paie, Achats, Stock, Housekeeping,
Maintenance, Rapports, Notifications) — `ComingSoon` mis à jour pour refléter que leur API existe
déjà, reste à brancher module par module ; sélecteur multi-hôtel (mentionné comme absent dans
Sidebar et Paramètres) ; 2FA fonctionnel (toujours hors périmètre depuis la Phase 3) ; écriture
Rôles/Permissions (toujours hors périmètre depuis la Phase 3) ; vraie file de synchronisation
offline-first (l'indicateur "sync" reste un simple reflet de `useIsFetching()`) ; composants
`Table`/`Select` réutilisables dans `packages/ui` (pas encore justifiés par le volume d'écrans).
