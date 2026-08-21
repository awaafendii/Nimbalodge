import { fmtGNF } from "@nimbalodge/utils";
import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useDepartments } from "../../hooks/use-departments.js";
import { useRevenues } from "../../hooks/use-finance-entries.js";
import { usePermission } from "../../hooks/use-permission.js";
import { computeTrend } from "./kpi-utils.js";

// Dashboard du sous-module Finance → Recettes (architecture module → sous-module). Aucune donnée
// fabriquée : tout est dérivé de GET /revenues, déjà chargé en entier pour le tableau existant
// (RevenuesCard, voir index.tsx) — pas de nouvel endpoint. Le scope organisation/hôtel/département
// est déjà appliqué côté backend (RevenuesService.list() + isolation department à hériter quand
// UserDepartment sera exploité ici comme ailleurs) : ce composant ne fait qu'agréger ce qu'on a
// le droit de voir.

export function RevenuesKpiBand() {
  const canView = usePermission("finance-revenues.view");
  const revenues = useRevenues();
  const departments = useDepartments();

  const stats = useMemo(() => {
    if (!revenues.data) return null;
    const now = new Date();
    const isSameDay = (d: Date) =>
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const isSameMonth = (d: Date, monthOffset: number) => {
      const ref = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
    };

    let today = 0;
    let thisMonth = 0;
    let lastMonth = 0;
    const byDepartment = new Map<string, number>();

    for (const revenue of revenues.data) {
      const date = new Date(revenue.date);
      const amount = Number(revenue.amount);
      if (isSameDay(date)) today += amount;
      if (isSameMonth(date, 0)) {
        thisMonth += amount;
        const key = revenue.departmentId ?? "__none__";
        byDepartment.set(key, (byDepartment.get(key) ?? 0) + amount);
      }
      if (isSameMonth(date, -1)) lastMonth += amount;
    }

    const recent = [...revenues.data]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return { today, thisMonth, lastMonth, byDepartment, recent };
  }, [revenues.data]);

  if (!canView) return null;

  if (revenues.isLoading) {
    return (
      <KpiGrid columns={3}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  if (!stats) return null;

  const departmentRows = [...stats.byDepartment.entries()]
    .map(([id, amount]) => ({
      id,
      name: id === "__none__" ? "Sans département" : (departments.data?.find((d) => d.id === id)?.name ?? "—"),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
  const departmentTotal = departmentRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={3}>
        <KpiCard icon={<Icons.IconTrend />} iconTone="good" label="Recettes du jour" value={fmtGNF(stats.today)} />
        <KpiCard
          icon={<Icons.IconTrend />}
          iconTone="good"
          label="Recettes du mois"
          value={fmtGNF(stats.thisMonth)}
          delta={computeTrend(stats.thisMonth, stats.lastMonth, true)}
        />
        <KpiCard icon={<Icons.IconWallet />} label="Recettes — mois précédent" value={fmtGNF(stats.lastMonth)} />
      </KpiGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Répartition par département — ce mois-ci</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune recette ce mois-ci.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {departmentRows.map((row) => (
                  <div key={row.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{row.name}</span>
                      <span className="tabular-nums text-muted-foreground">{fmtGNF(row.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-good"
                        style={{ width: `${departmentTotal > 0 ? (row.amount / departmentTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dernières recettes</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune recette enregistrée.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {stats.recent.map((revenue) => (
                  <li key={revenue.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="text-muted-foreground">
                      {new Date(revenue.date).toLocaleDateString("fr-FR")}
                    </span>
                    <span className="font-[var(--fw-subtitle-strong)]">{fmtGNF(Number(revenue.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
