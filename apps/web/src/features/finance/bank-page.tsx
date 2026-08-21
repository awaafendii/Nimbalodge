import { BankAccountsCard } from "./index.js";
import { BankKpiBand } from "./bank-kpi-band.js";

// Finance → Banque, quatrième sous-module (§8). Header = Topbar. Dashboard/KPI/alertes =
// BankKpiBand (nouveau). Tableau + formulaire + transactions = BankAccountsCard réutilisée telle
// quelle depuis index.tsx, aucune règle métier modifiée.
export default function FinanceBankPage() {
  return (
    <div className="flex flex-col gap-5">
      <BankKpiBand />
      <BankAccountsCard />
    </div>
  );
}
