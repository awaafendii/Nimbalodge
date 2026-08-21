import { ExpensesCard } from "./index.js";
import { ExpensesKpiBand } from "./expenses-kpi-band.js";

// Finance → Dépenses, deuxième sous-module (§8, après validation de Recettes). Header = Topbar.
// Dashboard/KPI/alertes = ExpensesKpiBand (nouveau). Tableau + formulaire + workflow d'approbation
// = ExpensesCard réutilisée telle quelle depuis index.tsx, aucune règle métier modifiée.
export default function FinanceExpensesPage() {
  return (
    <div className="flex flex-col gap-5">
      <ExpensesKpiBand />
      <ExpensesCard />
    </div>
  );
}
