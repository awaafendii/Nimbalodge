import { CashAccountsCard } from "./index.js";
import { CashKpiBand } from "./cash-kpi-band.js";

// Finance → Caisse, troisième sous-module (§8). Header = Topbar. Dashboard/KPI/alertes =
// CashKpiBand (nouveau). Tableau + formulaire + transactions = CashAccountsCard réutilisée telle
// quelle depuis index.tsx, aucune règle métier modifiée.
export default function FinanceCashPage() {
  return (
    <div className="flex flex-col gap-5">
      <CashKpiBand />
      <CashAccountsCard />
    </div>
  );
}
