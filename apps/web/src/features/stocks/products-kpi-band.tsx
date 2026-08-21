import { Icons, KpiCard, KpiGrid, ModuleAlertBanner, Skeleton, type ModuleAlert } from "@nimbalodge/ui";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { useProducts } from "../../hooks/use-products.js";
import { usePermission } from "../../hooks/use-permission.js";
import * as productsService from "../../services/products.js";

// Dashboard du sous-module Stocks → Articles. "Articles suivis"/en stock faible/ruptures dérivés
// de GET /products + GET /products/:id/stock pour chaque produit actif à seuil défini — même
// endpoint que la vue détail stock existante (ProductStockView, voir index.tsx), même calcul que
// ProductsService.findBelowThreshold() côté backend, sans jamais appeler POST /products/
// check-low-stock (effet de bord : crée des notifications, inadapté à un simple affichage de
// tableau de bord). Pas de KPI "valeur du stock" : Product n'a aucun champ prix/coût unitaire
// dans le modèle — un montant serait inventé, donc omis plutôt qu'affiché faux.
export function ProductsKpiBand() {
  const canView = usePermission("products.view");
  const products = useProducts();
  const trackedProducts = useMemo(
    () => (products.data ?? []).filter((p) => p.isActive && p.minThreshold !== null),
    [products.data]
  );

  const stockQueries = useQueries({
    queries: trackedProducts.map((product) => ({
      queryKey: ["products", product.id, "stock"],
      queryFn: () => productsService.getProductStock(product.id),
    })),
  });
  const stockLoading = stockQueries.some((q) => q.isLoading);

  const stats = useMemo(() => {
    if (stockLoading) return null;
    let lowStock = 0;
    const outOfStock: ModuleAlert[] = [];
    trackedProducts.forEach((product, i) => {
      const stock = stockQueries[i]?.data;
      if (!stock) return;
      const total = Number(stock.total);
      const threshold = Number(product.minThreshold);
      if (total <= 0) {
        outOfStock.push({ id: product.id, tone: "critical", message: `Rupture de stock : ${product.name}.` });
      } else if (total < threshold) {
        lowStock += 1;
      }
    });
    return { activeCount: (products.data ?? []).filter((p) => p.isActive).length, lowStock, outOfStock };
  }, [stockLoading, trackedProducts, stockQueries, products.data]);

  if (!canView) return null;

  if (products.isLoading || !stats) {
    return (
      <KpiGrid columns={3}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={3}>
        <KpiCard icon={<Icons.IconReport />} label="Articles suivis" value={stats.activeCount} />
        <KpiCard icon={<Icons.IconWarn />} iconTone={stats.lowStock > 0 ? "gold" : "default"} label="Stock faible" value={stats.lowStock} />
        <KpiCard icon={<Icons.IconWarn />} iconTone={stats.outOfStock.length > 0 ? "crit" : "default"} label="Ruptures" value={stats.outOfStock.length} />
      </KpiGrid>

      {stats.outOfStock.length > 0 ? <ModuleAlertBanner alerts={stats.outOfStock} /> : null}
    </div>
  );
}
