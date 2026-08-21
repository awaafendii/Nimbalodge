import { AttendanceCard } from "./index.js";
import { AttendanceKpiBand } from "./attendance-kpi-band.js";

// RH → Présence. Header = Topbar. Dashboard/KPI = AttendanceKpiBand (nouveau). Tableau +
// pointage = AttendanceCard réutilisée telle quelle depuis index.tsx.
export default function HrAttendancePage() {
  return (
    <div className="flex flex-col gap-5">
      <AttendanceKpiBand />
      <AttendanceCard />
    </div>
  );
}
