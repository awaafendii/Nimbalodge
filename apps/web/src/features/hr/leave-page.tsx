import { LeaveRequestsCard } from "./index.js";
import { LeaveKpiBand } from "./leave-kpi-band.js";

// RH → Congés. Header = Topbar. Dashboard/KPI = LeaveKpiBand (nouveau). Tableau + formulaire +
// workflow d'approbation = LeaveRequestsCard réutilisée telle quelle depuis index.tsx.
export default function HrLeavePage() {
  return (
    <div className="flex flex-col gap-5">
      <LeaveKpiBand />
      <LeaveRequestsCard />
    </div>
  );
}
