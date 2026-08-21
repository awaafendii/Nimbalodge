import { RevenuesCard } from "./index.js";
import { RevenuesKpiBand } from "./revenues-kpi-band.js";

// Finance → Recettes, premier sous-module de l'architecture module → sous-module (§8, sous-module
// pilote). Header = Topbar (titre/sous-titre dérivés de nav-config, inchangé). Dashboard/KPI/
// alertes = RevenuesKpiBand (nouveau). Tableau + formulaire d'ajout = RevenuesCard réutilisée telle
// quelle depuis index.tsx (mêmes champs, même workflow, aucune règle métier modifiée).
export default function FinanceRevenuesPage() {
  return (
    <div className="flex flex-col gap-5">
      <RevenuesKpiBand />
      <RevenuesCard />
    </div>
  );
}
