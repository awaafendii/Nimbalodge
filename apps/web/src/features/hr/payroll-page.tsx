import { PayslipsCard } from "../payroll/index.js";
import { PayrollKpiBand } from "./payroll-kpi-band.js";

// RH → Paie (/hr/payroll — Paie n'est plus un module racine séparé, voir router.tsx). Header =
// Topbar. Dashboard/KPI = PayrollKpiBand (nouveau). Tableau + formulaire + mark-paid = PayslipsCard
// réutilisée telle quelle depuis features/payroll/index.tsx (dossier conservé pour limiter le
// diff — seul le point d'entrée/la route changent, pas la logique métier ni son emplacement).
export default function HrPayrollPage() {
  return (
    <div className="flex flex-col gap-5">
      <PayrollKpiBand />
      <PayslipsCard />
    </div>
  );
}
