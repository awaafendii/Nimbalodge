# Phase 1 — Design system & architecture frontend

Décisions prises lors de la mise en place du socle technique frontend cible (brief §41-43),
en parallèle du prototype `nimbalodge-app/` qui reste gelé et inchangé.

## Monorepo : npm workspaces, pas pnpm

npm est déjà l'outil utilisé par `nimbalodge-app`. Introduire pnpm n'apporterait un gain réel
qu'à plus grande échelle (beaucoup de packages, gros installs) ; pour 4-5 packages en Phase 1,
ça ajouterait un outil de plus sans bénéfice net. `nimbalodge-app` est délibérément **hors**
des `workspaces` racine (`["apps/*", "packages/*"]`) pour garantir qu'aucune commande à la
racine (`npm install`, `npm run dev:web`) ne touche jamais son `node_modules` ni son lockfile.

## Palette : celle du prototype prime sur la palette générique du brief

`packages/ui/src/styles/tokens.css` est un port **verbatim** de
`nimbalodge-app/src/styles/tokens.css` — pas un remplacement par la palette indicative du brief
§40. Les deux directions (vert foncé + or, hospitality/fintech) sont très proches ; diverger
aurait fait perdre une palette déjà validée visuellement (support light/dark mature, sidebar
volontairement sombre dans les deux thèmes, rampe de graphiques CVD-safe) sans gain justifié.

## Pont vers le vocabulaire shadcn/ui — sans collision de noms

`packages/ui/src/styles/shadcn-bridge.css` traduit les tokens de marque vers les noms attendus
par les composants shadcn (`--background`, `--primary`, `--foreground`, ...). Règle stricte
respectée : **ce fichier ne redéfinit jamais un nom de variable déjà utilisé par tokens.css**
(`--accent`, `--border`, `--surface`, ...) — cela écraserait silencieusement sa valeur pour tout
le reste de l'app, les custom properties CSS n'étant pas namespacées. Le "accent" sémantique de
shadcn (état hover/surbrillance) pointe directement vers `--accent-soft`/`--accent-ink` existants
au lieu de recréer une variable `--accent` concurrente.

`--primary-foreground` et `--destructive-foreground` sont les deux seules variables qui doivent
être réévaluées par thème (créées, donc sans collision) : l'accent et le critical s'éclaircissent
en dark mode, donc le texte posé dessus doit s'assombrir — sinon les boutons primaires deviennent
illisibles en sombre. La cascade à 3 niveaux (`:root` clair par défaut → `@media
prefers-color-scheme: dark` → `[data-theme="dark"]`/`[data-theme="light"]`, ces derniers gagnant
toujours par spécificité) reproduit exactement le mécanisme déjà en place dans `tokens.css`.

## shadcn/ui : composants copiés à la main, pas via le CLI réseau

Les fichiers sous `packages/ui/src/components/` sont écrits à la main plutôt que générés par
`npx shadcn@latest add ...`, pour un résultat identique sans dépendre d'un appel réseau/CLI
interactif pendant la session d'implémentation. `components.json` est fourni pour permettre au
CLI shadcn d'être utilisé normalement dans le futur (ex. ajouter un nouveau composant).

Mapping avec le kit UI du prototype (classification de réutilisabilité issue de l'audit Phase 0) :

| Composant `nimbalodge-app` | Composant `packages/ui` | Note |
|---|---|---|
| `Card.jsx` | `card.tsx` | port direct |
| `Chip.jsx` | `badge.tsx` + `StatusBadge` | `StatusBadge` reproduit le mapping statut→libellé/couleur de `Chip.jsx` |
| `Drawer.jsx`, `InvoiceDrawer.jsx`, `NewInvoiceDrawer.jsx` | `sheet.tsx` | même usage panneau latéral |
| `Modal.jsx` | `dialog.tsx` | port direct |
| `Segmented.jsx` | `toggle-group.tsx` | plus fidèle que des Tabs (qui impliquent des panneaux de contenu) |
| `Kpi.jsx` | `kpi-card.tsx` | pas d'équivalent shadcn, porté à la main sur les valeurs exactes de `.kpi*` dans `components.css` |
| `Icons.jsx` | `icons/index.tsx` | port TSX verbatim ; `lucide-react` ajouté pour les icônes internes des primitives shadcn (X, chevrons) — coexiste sans conflit |
| `AppShell`/`Sidebar`/`Topbar` | idem (TSX + Tailwind) | `Sheet` pour la sidebar mobile (remplace le scrim manuel), `Avatar`+`DropdownMenu` pour le menu utilisateur, `ToggleGroup` pour le sélecteur de thème |
| `TrendChart.jsx`, `ExpenseBreakdown.jsx` | **non portés** | restent en SVG maison dans le prototype ; Recharts non installé (rien à grapher avant qu'un module métier existe, Phase 5/11) |

## Nav cible

La sidebar de `nimbalodge-app` est figée sur la gestion locative d'un immeuble (Appartements,
Locataires, Séjours meublés). `apps/web` porte à la place les 14 modules cibles du brief §43,
regroupés (Tableau de bord/Finance/Réservations/Chambres/Clients — RH & Paie — Achats & Stock —
Système), définis une seule fois dans `components/layout/nav-config.tsx` et consommés par
`Sidebar`, `Topbar` (titre/sous-titre) et `router.tsx` (routes). Toutes les features autres que
Dashboard affichent un composant `ComingSoon` indiquant la phase cible de leur implémentation
réelle — aucune donnée métier, aucun appel API en Phase 1.

## État : Zustand (UI seulement) + TanStack Query (plomberie seule)

Un unique store `stores/ui-store.ts` (thème, sidebar) persisté en `localStorage`, reproduisant le
comportement de `AppContext.jsx` (`theme: "auto"|"light"|"dark"` → attribut `data-theme` sur
`<html>`). Un `QueryClient` est monté (`app/providers.tsx`) mais aucune query n'existe encore —
la plomberie est prête pour la Phase 2+, sans données factices déguisées en API.

## Périmètre explicitement exclu de cette phase

Pas de backend, pas de base de données, pas d'authentification/RBAC réel, pas de reconnexion de
données métier, pas de portage des pages classées "réutilisables"/"à refactoriser"/"à
reconstruire" en Phase 0 (CashBank, Invoices, Reports, Dashboard, Settings, Furnished,
Apartments, Tenants) — uniquement le socle technique. `nimbalodge-app/` n'a reçu aucune
modification.
