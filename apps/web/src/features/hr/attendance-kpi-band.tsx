import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useAttendance } from "../../hooks/use-attendance.js";
import { useEmployees } from "../../hooks/use-employees.js";
import { usePermission } from "../../hooks/use-permission.js";

// Dashboard du sous-module RH → Présence. Présents/absents/taux dérivés de GET /attendances +
// GET /employees (déjà chargés pour AttendanceCard/EmployeesCard) — pas de nouvel endpoint. Pas de
// KPI "retardataires" : nécessiterait de comparer le pointage aux plannings (WorkSchedule), dont
// aucun service frontend n'existe encore et qui n'est branché sur aucun écran — ajouté plutôt
// qu'inventé un seuil arbitraire de retard.
export function AttendanceKpiBand() {
  const canView = usePermission("attendance.view");
  const attendance = useAttendance();
  const employees = useEmployees();

  const stats = useMemo(() => {
    if (!attendance.data || !employees.data) return null;
    const now = new Date();
    const isToday = (d: Date) =>
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

    const activeEmployeeIds = new Set(employees.data.filter((e) => e.isActive).map((e) => e.id));
    const presentToday = new Set(
      attendance.data.filter((a) => isToday(new Date(a.clockIn)) && activeEmployeeIds.has(a.employeeId)).map((a) => a.employeeId)
    );

    const activeCount = activeEmployeeIds.size;
    const presentCount = presentToday.size;
    const absentCount = Math.max(activeCount - presentCount, 0);
    const rate = activeCount > 0 ? (presentCount / activeCount) * 100 : 0;

    return { activeCount, presentCount, absentCount, rate };
  }, [attendance.data, employees.data]);

  if (!canView) return null;

  if (attendance.isLoading || employees.isLoading || !stats) {
    return (
      <KpiGrid columns={3}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  return (
    <KpiGrid columns={3}>
      <KpiCard icon={<Icons.IconUsers />} iconTone="good" label="Présents aujourd'hui" value={stats.presentCount} />
      <KpiCard icon={<Icons.IconUsers />} iconTone={stats.absentCount > 0 ? "gold" : "default"} label="Absents aujourd'hui" value={stats.absentCount} />
      <KpiCard icon={<Icons.IconTrend />} iconTone={stats.rate >= 90 ? "good" : "gold"} label="Taux de présence" value={`${Math.round(stats.rate)}%`} />
    </KpiGrid>
  );
}
