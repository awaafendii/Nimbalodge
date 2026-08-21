import { ProductsCard } from "../inventory/index.js";
import { ProductsKpiBand } from "./products-kpi-band.js";

// Stocks → Articles. Header = Topbar. Dashboard/KPI/alertes = ProductsKpiBand (nouveau). Tableau +
// formulaire = ProductsCard réutilisée telle quelle depuis features/inventory/index.js.
export default function StocksProductsPage() {
  return (
    <div className="flex flex-col gap-5">
      <ProductsKpiBand />
      <ProductsCard />
    </div>
  );
}
