import { StockMovementsCard } from "../inventory/index.js";
import { MovementsKpiBand } from "./movements-kpi-band.js";

// Stocks → Mouvements. Header = Topbar. Dashboard/KPI = MovementsKpiBand (nouveau). Tableau +
// formulaire = StockMovementsCard réutilisée telle quelle depuis features/inventory/index.js.
export default function StocksMovementsPage() {
  return (
    <div className="flex flex-col gap-5">
      <MovementsKpiBand />
      <StockMovementsCard />
    </div>
  );
}
