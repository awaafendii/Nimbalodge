import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard } from "@nimbalodge/ui";

// Démonstrateur du design system pour la Phase 1 — chiffres factices en dur, aucune donnée réelle
// (aucune API tant qu'apps/api n'existe pas). Le vrai Dashboard piloté par module/permission/hôtel
// arrive avec les modules métier (Phase 5+), en s'inspirant de Dashboard.jsx (classé "à
// refactoriser" en Phase 0) pour la structure (grille de KPI, cartes 2 colonnes).
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Icons.IconTrend />}
          iconTone="good"
          label="Recettes du mois"
          value="118 450 000 GNF"
          delta={{ value: -2.4, sentiment: "down" }}
        />
        <KpiCard
          icon={<Icons.IconWallet />}
          iconTone="gold"
          label="Dépenses du mois"
          value="24 380 000 GNF"
          delta={{ value: 6.3, sentiment: "down" }}
        />
        <KpiCard icon={<Icons.IconWallet />} label="Trésorerie" value="—" note="En attente du backend (Phase 2+)" />
        <KpiCard
          icon={<Icons.IconBed />}
          iconTone="crit"
          label="Taux d'occupation"
          value="—"
          note="En attente du module Réservations (Phase 7)"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Socle Phase 1</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Cette page démontre le design system (palette, typographie, composants) porté depuis
            le prototype <code>nimbalodge-app</code>. Les valeurs ci-dessus sont statiques.
          </p>
          <p>
            Les données réelles arriveront module par module à partir de la Phase 5, une fois
            l'organisation, les hôtels, les départements et l'API en place.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
