import { EmployeesCard } from "./index.js";
import { EmployeesKpiBand } from "./employees-kpi-band.js";

// RH → Employés, sous-module pilote (même architecture que Finance → Recettes). Header = Topbar.
// Dashboard/KPI = EmployeesKpiBand (nouveau). Tableau + formulaire = EmployeesCard réutilisée
// telle quelle depuis index.tsx, aucune règle métier modifiée.
export default function HrEmployeesPage() {
  return (
    <div className="flex flex-col gap-5">
      <EmployeesKpiBand />
      <EmployeesCard />
    </div>
  );
}
