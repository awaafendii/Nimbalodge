import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { usePermission } from "../../hooks/use-permission.js";
import { useStockMovements } from "../../hooks/use-stock-movements.js";
import { useWarehouses } from "../../hooks/use-warehouses.js";

// Dashboard du sous-module Stocks → Entrepôts. Entrepôts actifs vient de GET /warehouses ;
// mouvements par entrepôt agrège GET /stock-movements (déjà chargé pour StockMovementsCard) — pas
// de nouvel endpoint.
export function WarehousesKpiBand() {
  const canView = usePermission("warehouses.view");
  const warehouses = useWarehouses();
  const movements = useStockMovements();

  const stats = useMemo(() => {
    if (!warehouses.data || !movements.data) return null;
    const now = new Date();
    const thisMonth = movements.data.filter((m) => {
      const d = new Date(m.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const byWarehouse = new Map<string, number>();
    for (const m of thisMonth) {
      byWarehouse.set(m.warehouseId, (byWarehouse.get(m.warehouseId) ?? 0) + 1);
    }
    return { activeCount: warehouses.data.filter((w) => w.isActive).length, byWarehouse };
  }, [warehouses.data, movements.data]);

  if (!canView) return null;

  if (warehouses.isLoading || movements.isLoading || !stats) {
    return (
      <KpiGrid columns={2}>
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  const rows = [...stats.byWarehouse.entries()]
    .map(([id, count]) => ({ id, name: warehouses.data?.find((w) => w.id === id)?.name ?? "—", count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={2}>
        <KpiCard icon={<Icons.IconReport />} label="Entrepôts actifs" value={stats.activeCount} />
        <KpiCard icon={<Icons.IconReport />} label="Mouvements ce mois-ci (tous entrepôts)" value={[...stats.byWarehouse.values()].reduce((s, c) => s + c, 0)} />
      </KpiGrid>

      {rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Mouvements par entrepôt — ce mois-ci</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2.5">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{row.name}</span>
                  <span className="tabular-nums text-muted-foreground">{row.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
