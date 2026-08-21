import { InvoicesCard } from "./index.js";
import { InvoicesKpiBand } from "./invoices-kpi-band.js";

// Finance → Facturation, sixième et dernier sous-module Finance (§8). Header = Topbar.
// Dashboard/KPI/alertes = InvoicesKpiBand (nouveau). Tableau + formulaire + paiements/avoirs =
// InvoicesCard réutilisée telle quelle depuis index.tsx, aucune règle métier modifiée.
export default function FinanceInvoicesPage() {
  return (
    <div className="flex flex-col gap-5">
      <InvoicesKpiBand />
      <InvoicesCard />
    </div>
  );
}
