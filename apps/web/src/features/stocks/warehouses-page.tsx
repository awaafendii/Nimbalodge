import { WarehousesCard } from "../inventory/index.js";
import { WarehousesKpiBand } from "./warehouses-kpi-band.js";

// Stocks → Entrepôts. Header = Topbar. Dashboard/KPI = WarehousesKpiBand (nouveau). Tableau +
// formulaire = WarehousesCard réutilisée telle quelle depuis features/inventory/index.js.
export default function StocksWarehousesPage() {
  return (
    <div className="flex flex-col gap-5">
      <WarehousesKpiBand />
      <WarehousesCard />
    </div>
  );
}
