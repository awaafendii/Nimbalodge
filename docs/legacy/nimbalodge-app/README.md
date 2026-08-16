# NimbaLodge

Application React de gestion financière et administrative pour immeubles et résidences meublées — tableau de bord, appartements, locataires, facturation, caisse & banque, séjours meublés et rapports mensuels.

## Démarrage

```bash
npm install
npm run dev
```

L'application est servie sur `http://localhost:5173`.

## Build de production

```bash
npm run build
npm run preview
```

## Structure

```
src/
  components/
    charts/     # graphiques SVG (tendance, répartition des dépenses)
    icons/      # icônes SVG en composants React
    invoices/   # tiroirs de facturation (aperçu, nouvelle facture)
    layout/     # coquille de l'application (sidebar, topbar)
    ui/         # briques réutilisables (Card, Chip, Kpi, Drawer, Modal…)
  data/         # données de démonstration (appartements, locataires, factures, journal…)
  pages/        # une page par section de la barre latérale
  state/        # contexte applicatif (thème, devise, période, factures, journal)
  styles/       # jetons de design, mise en page, composants, impression
  utils/        # formatage (devises, dates)
```

## Typographie

- **Titres** — Manrope 700 / 800
- **Sous-titres** — Inter 500 / 600
- **Texte courant** — Inter 400
- **Boutons** — Inter 600
- **Petites informations** — Inter 400 / 500

Les polices sont auto-hébergées via `@fontsource`, sans dépendance à une CDN externe.

## Données

Toutes les données affichées sont des données de démonstration situées dans `src/data/` — à remplacer par vos appels API / votre backend le moment venu. L'état applicatif (factures émises, opérations de caisse ajoutées, thème, devise) est géré via `src/state/AppContext.jsx`.
