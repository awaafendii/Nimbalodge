import { Badge, Card, CardContent, CardHeader, CardTitle } from "@nimbalodge/ui";

// Le backend de chaque module métier est terminé depuis les Phases 4-13 (voir
// docs/architecture/phase-*.md) — ce composant ne signifie plus "backend manquant" mais
// "frontend pas encore branché sur l'API réelle", chantier module par module à partir de la
// Phase 14 (voir docs/architecture/phase-14-frontend-connection.md).
export function ComingSoon({ module }: { module: string }) {
  return (
    <Card className="mx-auto mt-6 max-w-xl border-dashed">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{module}</CardTitle>
          <Badge variant="secondary">Pas encore branché</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          L'API backend de ce module est déjà en production (voir la documentation d'architecture),
          mais cet écran ne l'utilise pas encore. Le branchement se fait module par module à partir
          du Tableau de bord, de Paramètres et de Finance.
        </p>
      </CardContent>
    </Card>
  );
}
