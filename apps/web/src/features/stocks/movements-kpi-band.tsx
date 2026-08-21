import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { usePermission } from "../../hooks/use-permission.js";
import { useStockMovements } from "../../hooks/use-stock-movements.js";
import type { StockMovementType } from "../../services/stock-movements.js";

const TYPE_LABELS: Record<StockMovementType, string> = {
  IN: "Entrées",
  OUT: "Sorties",
  TRANSFER: "Transferts",
  ADJUSTMENT: "Ajustements",
  CONSUMPTION: "Consommations",
  LOSS: "Pertes",
};

// Dashboard du sous-module Stocks → Mouvements. Aucune donnée fabriquée : tout est dérivé de
// GET /stock-movements, déjà chargé en entier pour StockMovementsCard — pas de nouvel endpoint.
export function MovementsKpiBand() {
  const canView = usePermission("stock-movements.view");
  const movements = useStockMovements();

  const stats = useMemo(() => {
    if (!movements.data) return null;
    const now = new Date();
    const thisMonth = movements.data.filter((m) => {
      const d = new Date(m.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const byType = new Map<StockMovementType, number>();
    for (const m of thisMonth) {
      byType.set(m.type, (byType.get(m.type) ?? 0) + 1);
    }
    return { total: thisMonth.length, byType };
  }, [movements.data]);

  if (!canView) return null;

  if (movements.isLoading || !stats) {
    return (
      <KpiGrid columns={2}>
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  const typeRows = [...stats.byType.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={2}>
        <KpiCard icon={<Icons.IconReport />} label="Mouvements ce mois-ci" value={stats.total} />
        <KpiCard icon={<Icons.IconReport />} label="Types de mouvement actifs" value={typeRows.length} />
      </KpiGrid>

      {typeRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Répartition par type — ce mois-ci</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2.5">
              {typeRows.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{TYPE_LABELS[type]}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
