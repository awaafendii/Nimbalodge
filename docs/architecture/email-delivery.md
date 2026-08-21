# Email transactionnel réel — réinitialisation de mot de passe

Fait suite à Étape 7 (durcissement Auth), qui avait posé `PasswordResetService` avec un lien
uniquement journalisé, faute de fournisseur email branché — documenté comme risque résiduel
explicite jusqu'à cette étape. Objectif : un envoi réel, gratuit, sans que l'utilisateur possède un
nom de domaine.

## `EmailProvider` — même pattern que `LLMProvider`/`StorageProvider`

`modules/email/email-provider.interface.ts` définit `EmailProvider { name, isConfigured(),
send(params) }`, injecté via `EMAIL_PROVIDER_TOKEN`. `modules/email/email.module.ts` sélectionne
l'implémentation par `EMAIL_PROVIDER` (défaut `"brevo"`), même structure que
`LlmProviderModule`/`STORAGE_PROVIDER` — le reste du code (`PasswordResetService`) ne dépend que de
l'interface, jamais d'un SDK/API concret. `BrevoProvider` (`providers/brevo.provider.ts`) est la
seule implémentation réelle : appel HTTP direct (`fetch` global, Node ≥20) vers
`https://api.brevo.com/v3/smtp/email` — pas de SDK ajouté, un seul endpoint utilisé.

## Pourquoi Brevo, sans nom de domaine

Choisi pour son plan gratuit (300 emails/jour, à vie, sans carte bancaire) — très largement
suffisant pour un volume de reset de mot de passe. Brevo permet de vérifier une **adresse email
unique** comme expéditeur (confirmation par email, Paramètres → Expéditeurs) sans posséder de nom
de domaine ni configurer SPF/DKIM — c'est la contrainte explicite de cette étape (l'utilisateur n'a
pas de domaine). Conséquence assumée : la délivrabilité (arriver en boîte de réception plutôt qu'en
spam) est moins garantie qu'avec un domaine authentifié — acceptable pour ce volume, à revisiter si
un domaine est acquis plus tard (aucun changement de code nécessaire, seulement la vérification
d'un domaine côté Brevo).

`BREVO_API_KEY` ET `EMAIL_FROM_ADDRESS` sont toutes deux requises pour que
`BrevoProvider.isConfigured()` soit vrai — une clé sans expéditeur vérifié n'a aucun sens (Brevo
refuserait l'envoi). Toutes deux optionnelles au démarrage (`env.validation.ts`) : l'app démarre
normalement sans elles, exactement comme `GEMINI_API_KEY`.

## Repli inchangé, jamais bloquant

`PasswordResetService.requestReset()` : si `emailProvider.isConfigured()` est faux, comportement
strictement identique à avant cette étape (lien journalisé via `PinoLogger`, jamais dans la réponse
HTTP). Si vrai, `emailProvider.send()` est appelé **best-effort** — un échec (quota, panne réseau)
est capturé et journalisé en `warn`, ne fait jamais échouer la requête ni changer sa réponse : la
réponse de `requestReset()` reste identique dans tous les cas (anti-énumération déjà en place,
étendue au succès/échec d'envoi).

## Lien cliquable — réutilisation de `CORS_ORIGIN`, jamais un nouvel identifiant obligatoire

Le lien envoyé est `${WEB_APP_URL ?? CORS_ORIGIN}/reset-password?token=...`. `WEB_APP_URL` est une
variable optionnelle dédiée pour la clarté (nommée pour son usage réel plutôt que de réutiliser
silencieusement `CORS_ORIGIN` sans l'expliquer) mais retombe sur `CORS_ORIGIN` si absente — les
deux pointent déjà vers la même origine frontend dans tous les déploiements actuels (dev comme
Render), donc aucune nouvelle variable n'est requise pour que ça fonctionne immédiatement.

## Frontend — deux pages publiques, jamais construites avant cette étape

Le backend (`POST /auth/password-reset/{request,confirm}`) existait déjà depuis Étape 7, mais
`apps/web` n'avait ni lien "mot de passe oublié", ni page pour consommer un token — l'email aurait
pointé vers une route inexistante. Ajouté :
- `features/auth/forgot-password.tsx` (`/forgot-password`, public) — email → message générique
  identique que le compte existe ou non, jamais une confirmation d'existence.
- `features/auth/reset-password.tsx` (`/reset-password?token=...`, public) — lit le token
  exclusivement depuis l'URL, deux champs (nouveau + confirmation), erreur claire si le lien est
  incomplet. Succès → redirige vers `/login` avec un bandeau de confirmation.
- `login.tsx` — lien "Mot de passe oublié ?" ajouté à côté du champ mot de passe.

## Tests

- **Unit** (`password-reset.service.spec.ts`) : chemin journalisé (non configuré) inchangé, envoi
  réel avec le bon lien (configuré), échec d'envoi non bloquant (best-effort) — 3 nouveaux cas.
- **E2E** : `password-reset.e2e-spec.ts` complété d'un `describe` séparé (son propre budget de
  throttle, 3/60s sur `/password-reset/request`) qui bascule `FakeEmailProvider.setConfigured(true)`
  et vérifie qu'un email est réellement "envoyé" (jamais de log) avec le lien attendu.
  `FakeEmailProvider` (`modules/email/providers/fake-email.provider.ts`) substitué à `BrevoProvider`
  dans **tous** les tests (`test-app.ts`, `overrideProvider(EMAIL_PROVIDER_TOKEN)`) — jamais un vrai
  appel réseau Brevo depuis la suite de tests, même pattern que `FakeLLMProvider`.

## Vérification

- `npm run typecheck` (monorepo complet), `npm run build:api`, `npm run build:web` — verts.
- `npm run test:api:unit` (148 tests) et `npm run test:api:e2e` (95 tests, dont le nouveau
  `describe` email réel) — verts.
- Activation réelle non vérifiée en direct (nécessiterait un compte Brevo réel, hors de portée
  d'une vérification automatisée) — la marche à suivre (`docs/deployment/render.md`, étape 6) reste
  à exécuter par l'opérateur, comme pour `GEMINI_API_KEY`/`BOOTSTRAP_ADMIN_*`.

## Périmètre exclu

Vérification de domaine (SPF/DKIM) — contrainte explicite "pas de domaine" de cette étape ;
templates HTML enrichis (logo, mise en forme avancée) — email texte/HTML minimal, fonctionnel ;
autres notifications transactionnelles par email (aucune n'existe aujourd'hui, seul le reset de mot
de passe envoie un email) ; `SendGridProvider`/`SesProvider` alternatifs — l'abstraction les rend
possibles sans toucher `PasswordResetService`, mais aucun n'est implémenté.

## Voir aussi

- `docs/security/overview.md` section 3 (Authentification) et section 10 (Risques résiduels).
- `docs/deployment/render.md` étape 6 — marche à suivre Brevo dans le dashboard Render.
