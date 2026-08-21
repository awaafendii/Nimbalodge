import { BudgetsCard } from "./index.js";
import { BudgetsKpiBand } from "./budgets-kpi-band.js";

// Finance → Budget, cinquième sous-module (§8). Header = Topbar. Dashboard/KPI/alertes =
// BudgetsKpiBand (nouveau). Tableau + formulaire + exécution = BudgetsCard réutilisée telle quelle
// depuis index.tsx, aucune règle métier modifiée.
export default function FinanceBudgetsPage() {
  return (
    <div className="flex flex-col gap-5">
      <BudgetsKpiBand />
      <BudgetsCard />
    </div>
  );
}
