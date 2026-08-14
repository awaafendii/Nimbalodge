# @nimbalodge/config

Placeholder créé en Phase 1 pour réserver l'emplacement dans l'arborescence cible (brief §42).

Accueillera les configurations partagées (ESLint, Prettier, tsconfig applicatif) une fois
`apps/api` créé (Phase 2) et qu'il y aura plusieurs apps consommant les mêmes règles. En Phase 1,
`apps/web` et `packages/ui` étendent directement `tsconfig.base.json` à la racine — pas assez
d'apps encore pour justifier une couche de config partagée séparée.
