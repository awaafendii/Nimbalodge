# Nimba AI — architecture

Moteur d'intelligence intégré à NimbaLodge, construit en 9 étapes (voir historique git — un commit
par étape, tous préfixés `Nimba AI Etape N :`) : architecture, orchestrateur, RBAC/scope, data
access layer, abstraction LLM, fournisseur Gemini, Insights, détection d'anomalies, assistant
conversationnel. Trois capacités exposées à l'utilisateur : **Insights** (résumés/tendances déjà
calculés), **Anomalies** (règles et seuils déterministes), **Assistant** (question en langage
naturel, function-calling sur les mêmes Tools que les deux capacités précédentes). Pour le
comportement de sécurité transversal (RBAC, audit, throttling...), voir `docs/security/overview.md`
section 9 — celui-ci est le document normatif pour l'architecture propre à Nimba AI.

## Invariant absolu

**Nimba AI n'a jamais d'accès direct à PostgreSQL, ni de chemin qui contourne
RBAC/scope/confidentialité/Audit Trail.** Tout accès à une donnée métier passe par un Tool, qui
appelle exclusivement un Business Service existant avec le vrai `AuthenticatedUser` de la requête —
jamais de requête Prisma dans le module `nimba-ai` lui-même. Un LLM ne calcule jamais un chiffre
métier ; il ne fait que choisir quel Tool interroger (function-calling) et reformuler en langage
naturel un résultat déjà calculé par le backend.

## Séparation des responsabilités

| Couche | Responsabilité | Ne fait jamais |
|---|---|---|
| ERP (Prisma/PostgreSQL) | Source de vérité des données | — |
| Business Services (existants + `hospitality-insights`, `hr-insights`, `anomaly-detection`) | Calculs métier/financiers, RBAC/scope | Générer du langage |
| Nimba AI (orchestrateur, Tools, minimisation) | Orchestration, sécurité, mise en contexte | Calculer un chiffre métier lui-même |
| LLM (Gemini via `LLMProvider`) | Compréhension de la question, génération de langage | Être la source d'un chiffre, décider d'un accès |

Concrètement : **le backend calcule, le LLM explique.**

## Pipeline de sécurité et de minimisation

```
Utilisateur (Insights/Anomalies/Assistant)
   │  même JWT access token que le reste de l'app
   ▼
NimbaAiController → AiOrchestratorService.resolveContext(user)
   │  résout UNE FOIS permissions (PermissionsService.resolveForUser) et scope département
   │  (DepartmentsService.getDepartmentIds) -- mêmes primitives que PermissionsGuard/
   │  assertInDepartmentScope, jamais de logique de permission réimplémentée ici.
   ▼
AiToolRegistry.invoke(name, input, context)
   │  refus déterministe AVANT tout accès donnée si context.permissions ne couvre pas TOUTES les
   │  requiredPermissions du Tool (AND, jamais OR) -- refus audité (AuditLog, action "tool-denied").
   ▼
Tool.execute(input, context) → Business Service (RESERVATION.view, employees.view, ...)
   │  assertInScope()/assertInDepartmentScope() s'exécutent exactement comme pour l'API REST
   │  équivalente -- aucune logique de scope dupliquée.
   ▼
DataMinimizer.minimize(raw) → { data, provenance }
   │  ne garde que les agrégats/champs nécessaires -- ex. masse salariale : total + nombre de
   │  bulletins, JAMAIS de liste nominative même si le service sous-jacent avait les noms en
   │  mémoire pour calculer le total.
   ▼
(Assistant uniquement) AiChatService sérialise UNIQUEMENT { data, provenance } dans le message
   renvoyé au LLM -- jamais context.user/permissions (vérifié explicitement,
   ai-chat.service.spec.ts).
   ▼
AiResponseEnvelope { data, provenance, answer?, disclaimer? } → frontend
   `data`+`provenance` toujours calculés par le backend ; `answer` est un habillage optionnel,
   absent si aucun LLM configuré ou en échec -- jamais un substitut de `data`.
```

**Permission "porte d'entrée"** : `nimba-ai.use` (catalogue `prisma/permissions-catalog.ts`) gate
la fonctionnalité elle-même sur les 6 endpoints (`GET /nimba-ai/insights/*`, `GET
/nimba-ai/anomalies`, `POST /nimba-ai/chat`). Aucune permission synthétique par domaine : chaque
Tool exige exactement la/les permission(s) réelle(s) qui gate(nt) déjà l'équivalent REST
(`finance-summary.view`, `payslips.view`, `reservations.view`, `employees.view`,
`reports.financial.view`) — une permission IA séparée aurait pu diverger de la permission données
réelle et créer un trou de sécurité. Seule exception : `anomaly-scan`, dont
`requiredPermissions` est volontairement **vide** au niveau du registre (un scan couvre plusieurs
domaines de permission différents) — le filtrage réel est fait détecteur par détecteur dans
`AnomalyDetectionService.detectAnomalies()`, contre le même `context.permissions` déjà résolu.

## Modules backend

| Module | Fichiers clés | Rôle |
|---|---|---|
| `modules/nimba-ai/orchestrator` | `ai-orchestrator.service.ts` | `resolveContext()` + `invokeTool()` (point de passage unique vers un Tool, audite les refus). |
| `modules/nimba-ai/tools` | `ai-tool.interface.ts`, `ai-tool-registry.ts`, `*.tool.ts` (6) | Un Tool par capacité de lecture ; `AiToolRegistry` applique le refus RBAC déterministe et fournit `listAvailable()` (function-calling) et `invoke()`. |
| `modules/nimba-ai/context` | `data-minimizer.interface.ts`, `*.minimizer.ts` (5), `provenance.ts` | Un `DataMinimizer` par Tool ; `buildProvenance()` construit `{module, period?, filters?}`. |
| `modules/nimba-ai/providers` | `llm-provider.interface.ts`, `gemini.provider.ts`, `fake-llm.provider.ts`, `llm-provider.module.ts` | Abstraction `LLMProvider` échangeable ; `GeminiProvider` seule implémentation réelle ; `FakeLLMProvider` pour tous les tests (unit + e2e). |
| `modules/nimba-ai/conversation` | `conversation-provider.interface.ts`, `stateless-conversation.provider.ts` | v1 sans état : l'historique vient entièrement du frontend à chaque tour. |
| `modules/nimba-ai/chat` | `ai-chat.service.ts` | Boucle function-calling multi-tours (Étape 9, voir section dédiée). |
| `modules/nimba-ai/usage` | `ai-usage.service.ts` | `AiUsageLog` — métering (coûts/quotas futurs), pas de la sécurité. |
| `modules/hospitality-insights` | `hospitality-insights.service.ts` | Occupation, ADR, RevPAR, réservations par statut — module autonome, réutilisable hors IA. |
| `modules/hr-insights` | `hr-insights.service.ts` | Effectifs/absentéisme/congés + masse salariale — module autonome. |
| `modules/anomaly-detection` | `anomaly-detection.service.ts`, `detectors/*.detector.ts` (6) | Un `AnomalyDetector` par source de données, interface pluggable — voir section dédiée. |

`nimba-ai.controller.ts` délègue directement à `AiOrchestratorService`/`AiChatService` — pas de
`nimba-ai.service.ts` intermédiaire (décision Étape 7 : une couche de délégation supplémentaire
n'aurait ajouté aucune logique pour un simple passthrough GET/POST).

## Modules frontend

| Fichier | Rôle |
|---|---|
| `services/nimba-ai.ts` | Formes miroir des DTO backend, une fonction par endpoint. |
| `hooks/use-nimba-ai.ts` | Un hook React Query par capacité — chaque Insight est indépendant (403 sur l'un n'empêche jamais les autres). |
| `features/nimba-ai/index.tsx` | Page hôte, 3 onglets (Insights/Anomalies/Assistant), bascule locale par state React. |
| `features/nimba-ai/insights.tsx`, `anomalies.tsx`, `chat.tsx` | Un composant par onglet. Chacun affiche systématiquement sa provenance (`Source : ...`) à côté des chiffres — jamais uniquement un habillage IA. |

## LLM Provider — abstraction et matrice de configuration

`LLMProvider { name, isConfigured(), generate(params) }` — `GEMINI_API_KEY`/`LLM_PROVIDER`/
`GEMINI_MODEL` restent **optionnelles** dans `EnvironmentVariables` (`env.validation.ts`),
contrairement aux secrets JWT : un déploiement ne doit jamais refuser de démarrer à cause de cette
fonctionnalité. `GeminiProvider` (`@google/genai`) ne construit son client qu'à l'intérieur de
`generate()`, jamais dans le constructeur.

| | IA non configurée | IA configurée | Erreur fournisseur (quota, timeout...) |
|---|---|---|---|
| Insights déterministes | ✅ données + provenance | ✅ idem | ✅ idem (jamais appelé) |
| Anomalies déterministes | ✅ données + provenance | ✅ idem | ✅ idem (jamais appelé) |
| Assistant conversationnel | ❌ message clair, jamais 500 | ✅ réponse + sources | ❌ disclaimer, jamais 500, `AiUsageLog` statut `FAILURE` |

Vérifié en e2e (`nimba-ai-security.e2e-spec.ts`) : une erreur fournisseur sur `/nimba-ai/chat`
n'affecte jamais `/nimba-ai/insights/*` dans la même requête de test — chemins de code
indépendants, l'Insight n'invoque jamais `LLM_PROVIDER_TOKEN`.

## Détection d'anomalies — règles déterministes v1

Aucun ML dans cette version (contrainte explicite du brief) : seuils, moyennes, écarts relatifs
période/période uniquement. `AnomalyDetectionService.detectAnomalies()` ne fait tourner un
détecteur que si sa `requiredPermission` est dans le `context.permissions` déjà résolu, avec
résilience par détecteur (`.catch(() => [])` — l'échec d'une source n'empêche jamais les autres).

| Détecteur | Permission | Réutilise |
|---|---|---|
| `BudgetOverspendDetector` | `finance-budgets.view` | `BudgetsService.list()`/`getExecution()` |
| `RevenueExpenseTrendDetector` | `reports.financial.view` | `ReportsService.financialReport()` (groupBy catégorie) |
| `CashAnomalyDetector` | `finance-cash-accounts.view` | `CashAccountsService.list()`/`listTransactions()` |
| `StockAnomalyDetector` | `products.view` | `ProductsService.findBelowThreshold()` (extrait de `checkLowStock()`) |
| `HrAnomalyDetector` | `employees.view` | `HrInsightsService.getWorkforceSummary()` (absentéisme courant vs précédent) |
| `AuditTrailAnomalyDetector` | `audit-logs.view` | `AuditLogsService.countFailuresByActor()` (rafales par utilisateur/IP) |

Chaque `Anomaly` porte `severity`/`indicator`/`period`/`observedValue`/`referenceValue`/
`explanation`/`recommendation?` — `explanation` reste factuelle (ce qui a été observé et comparé),
jamais une certitude sur la cause.

## Assistant conversationnel — boucle function-calling

`AiChatService.chat()` (max **4** itérations LLM↔Tools) :

1. Si `!llmProvider.isConfigured()` → message clair immédiat, aucun appel, rien journalisé dans
   `AiUsageLog` (aucune tentative réelle).
2. `AiOrchestratorService.resolveContext(user)` puis `AiToolRegistry.listAvailable(context)` →
   liste de function declarations (nom/description/JSON Schema) proposée au LLM — un Tool que le
   demandeur ne pourrait pas invoquer n'est même pas proposé (commodité UX ; la vérification réelle
   reste `invokeTool()`).
3. `llmProvider.generate({messages, tools, systemPrompt})` — le prompt système interdit
   explicitement d'inventer un chiffre et d'afficher une hypothèse comme un fait.
4. Si la réponse contient des `toolCalls` : chacun passe par
   `AiOrchestratorService.invokeTool(name, args, user)` — **jamais** `AiToolRegistry` directement.
   Un refus RBAC devient un message `role: "tool"` (`"Accès refusé..."`) réinjecté dans la
   conversation, jamais une exception qui casserait la requête — le LLM reformule alors un refus
   poli plutôt que de planter.
5. `AiUsageService.record()` après **chaque** tentative d'appel LLM (succès, échec fournisseur) —
   jamais seulement les succès.
6. Réponse finale : `AiChatResponse { answer?, provenance[], toolResults[], disclaimer? }` —
   `toolResults` porte les données brutes déjà minimisées de chaque Tool invoqué, affichées par le
   frontend à côté du texte généré (jamais uniquement le texte).

## Mise à jour — RBAC multi-hôtel (`HotelMembership`)

`PermissionsService.resolveForUser()` a gagné un second paramètre (`activeHotelId`) pour intégrer
`HotelMembership` (voir `docs/architecture/rbac-multi-hotel.md`) — `AiOrchestratorService
.resolveContext()` appelait déjà `resolveForUser(user.id, user.hotelId)`, donc **aucun changement
de code** n'a été nécessaire côté Nimba AI, seulement l'extension de signature en amont. Ce qui a
changé : `user.hotelId` (le JWT de la session) reflète désormais l'hôtel actif choisi via
`switch-hotel`, potentiellement différent à chaque requête pour un même utilisateur multi-hôtel —
`resolveContext()` recalcule donc un jeu de permissions différent après chaque switch, exactement
comme pour l'API REST.

Invariant vérifié explicitement pour la première fois cette étape (déjà vrai depuis Étape 4, mais
jamais testé sous cet angle) : **aucun des 6 Tools ne définit de paramètre `hotelId`** dans son
schéma de function-calling — l'hôtel résolu vient uniquement de `context.user.hotelId`. Une
question qui nomme un autre hôtel que celui de la session active ne peut donc pas faire fuiter les
données de cet hôtel, par construction de l'interface (pas une règle de filtrage qui pourrait avoir
un trou). Vérifié par `test/nimba-ai-hotel-membership.e2e-spec.ts`.

## Tests

- **Unit** : un `*.spec.ts` par Tool/Minimizer/Detector/Provider, plus `ai-tool-registry.spec.ts`
  (refus déterministe exhaustif) et `ai-chat.service.spec.ts` (boucle function-calling, refus RBAC
  reformulé, échec fournisseur, limite d'itérations, aucune fuite de contexte dans le message
  renvoyé au LLM).
- **E2E** : `nimba-ai.e2e-spec.ts` (RBAC réel par endpoint, isolation d'organisation, rejeu exact de
  l'exemple du brief), `nimba-ai-security.e2e-spec.ts` (passe dédiée Étape 11 : rejeu du brief via
  le *chat*, cohérence stricte des chiffres avec l'endpoint métier équivalent, indépendance
  Insights/erreur LLM, surface figée du registre de Tools — aucun verbe d'écriture),
  `nimba-ai-hotel-membership.e2e-spec.ts` (RBAC multi-hôtel : isolation via `HotelMembership`,
  changement de contexte après `switch-hotel` réel — vérifié numériquement, aucune fuite même
  quand la question nomme explicitement un autre hôtel, `nimba-ai.use` indépendant de toute
  permission de domaine, audit d'un refus Tool avec le bon `hotelId`, parité AI/REST pour
  `department-comparison`).
- **Garde statique** : `security-invariants.spec.ts` — aucun fichier de `tools/`, `context/`,
  `orchestrator/`, `chat/` n'importe `PrismaService` (seul `usage/ai-usage.service.ts`, télémétrie
  non métier, y échappe légitimement).
- **`FakeLLMProvider`** substitué à `GeminiProvider` dans **tous** les tests e2e
  (`test-app.ts`, `overrideProvider(LLM_PROVIDER_TOKEN)`) — `@prisma/client` charge le `.env` réel
  du poste comme effet de bord de sa propre résolution d'`env()`, ce qui avait fait fuiter la vraie
  clé Gemini de dev dans un premier essai de test e2e (découvert et corrigé avant tout commit,
  Étape 9) ; substituer le provider au lieu de manipuler `process.env` est la solution robuste.

## Décisions d'architecture notables

- **Modules Hospitality/HR/Anomaly autonomes** plutôt qu'internes à `nimba-ai` — réutilisables plus
  tard par un écran Rapports classique sans dépendre de l'IA, garde `nimba-ai` mince.
- **Un `AnomalyDetector`/`Tool` par source** plutôt qu'un service monolithique — permet d'ajouter
  plus tard un détecteur statistique/ML ou un nouveau domaine sans toucher le reste.
- **`FakeLLMProvider` avec `enqueue()`/`enqueueError()`** plutôt qu'un mock ad hoc par test — un
  seul double programmable, réutilisé identiquement en unit et en e2e.
- **Pas de tables `Conversation`/`Message`** en v1 — `ConversationProvider` est l'abstraction qui
  rend un futur `DatabaseConversationProvider` substituable sans toucher l'orchestrateur ni le
  contrôleur, mais rien n'est persisté tant que ce besoin n'est pas confirmé.

## Risques résiduels / limites connues (v1)

- **Aucun ML/forecasting** dans la détection d'anomalies (contrainte explicite du brief) — les
  interfaces (`AnomalyDetector`) sont conçues pour en accueillir plus tard sans réécriture.
- **Conversation sans état côté serveur** : l'historique est perdu à la fermeture de l'onglet
  (state React uniquement) ; aucune limite de taille appliquée à l'historique renvoyé par le
  frontend au-delà de la validation par message (`AiChatQueryDto`, 8000 caractères/message).
- **`AiUsageLog` sans écran de consultation** — le modèle existe et est déjà alimenté, l'UI viendra
  avec un futur système de quotas.
- **Un seul fournisseur réel (`gemini`)** — `LLMProvider` est prêt pour `OpenAIProvider`/
  `AnthropicProvider`/`OpenRouterProvider`, aucun n'est implémenté.

## Voir aussi

- `docs/security/overview.md` section 9 — invariants de sécurité normatifs (résumé du pipeline
  ci-dessus, dans le document normatif transversal).
- `docs/architecture/rbac-multi-hotel.md` — `HotelMembership`, `switch-hotel`, intégration avec
  `resolveForUser()` et vérification RBAC multi-hôtel côté Nimba AI.
- `docs/architecture/testing.md` — fondation de tests, principe "vraie base, pas de mocks".
