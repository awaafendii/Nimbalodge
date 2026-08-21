import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { usePermission } from "../../hooks/use-permission.js";
import { useProducts } from "../../hooks/use-products.js";
import { useStockMovements } from "../../hooks/use-stock-movements.js";
import { useWarehouses } from "../../hooks/use-warehouses.js";

// Stocks → Vue d'ensemble (`/stocks`), même principe que Finance/RH/Hébergement : un KPI de
// synthèse par sous-module, cliquable vers son écran détaillé (le détail stock faible/ruptures,
// plus coûteux à calculer — GET /products/:id/stock par article suivi — reste sur l'écran Articles
// plutôt que dupliqué ici).
function OverviewCard({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block rounded-xl transition-opacity hover:opacity-90">
      {children}
    </Link>
  );
}

export function StocksOverviewPage() {
  const canViewProducts = usePermission("products.view");
  const canViewMovements = usePermission("stock-movements.view");
  const canViewWarehouses = usePermission("warehouses.view");

  const products = useProducts();
  const movements = useStockMovements();
  const warehouses = useWarehouses();

  const activeProducts = useMemo(() => products.data?.filter((p) => p.isActive).length ?? null, [products.data]);
  const movementsThisMonth = useMemo(() => {
    if (!movements.data) return null;
    const now = new Date();
    return movements.data.filter((m) => {
      const d = new Date(m.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [movements.data]);
  const activeWarehouses = useMemo(() => warehouses.data?.filter((w) => w.isActive).length ?? null, [warehouses.data]);

  const visibleCount = [canViewProducts, canViewMovements, canViewWarehouses].filter(Boolean).length;

  if (visibleCount === 0) {
    return <p className="text-sm text-muted-foreground">Aucun sous-module Stocks accessible.</p>;
  }

  return (
    <KpiGrid columns={Math.min(Math.max(visibleCount, 2), 3) as 2 | 3}>
      {canViewProducts ? (
        activeProducts !== null ? (
          <OverviewCard to="/stocks/products">
            <KpiCard icon={<Icons.IconReport />} label="Articles suivis" value={activeProducts} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewMovements ? (
        movementsThisMonth !== null ? (
          <OverviewCard to="/stocks/movements">
            <KpiCard icon={<Icons.IconReport />} label="Mouvements ce mois-ci" value={movementsThisMonth} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewWarehouses ? (
        activeWarehouses !== null ? (
          <OverviewCard to="/stocks/warehouses">
            <KpiCard icon={<Icons.IconReport />} label="Entrepôts actifs" value={activeWarehouses} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}
    </KpiGrid>
  );
}
