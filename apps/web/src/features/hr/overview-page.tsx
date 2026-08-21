import { fmtGNF } from "@nimbalodge/utils";
import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { useAttendance } from "../../hooks/use-attendance.js";
import { useEmployees } from "../../hooks/use-employees.js";
import { useLeaveRequests } from "../../hooks/use-leave-requests.js";
import { usePayslips } from "../../hooks/use-payslips.js";
import { usePermission } from "../../hooks/use-permission.js";

// RH → Vue d'ensemble (`/hr`, index de HrLayout), même principe que Finance → Vue d'ensemble : un
// KPI de synthèse par sous-module, cliquable vers son écran détaillé — pas le détail complet (déjà
// sur l'écran du sous-module). Réutilise les mêmes sources que les sous-modules, aucune nouvelle
// agrégation serveur.
function OverviewCard({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block rounded-xl transition-opacity hover:opacity-90">
      {children}
    </Link>
  );
}

export function HrOverviewPage() {
  const canViewEmployees = usePermission("employees.view");
  const canViewLeave = usePermission("leave-requests.view");
  const canViewAttendance = usePermission("attendance.view");
  const canViewPayroll = usePermission("payslips.view");

  const employees = useEmployees();
  const leaveRequests = useLeaveRequests();
  const attendance = useAttendance();
  const payslips = usePayslips();

  const activeCount = useMemo(() => employees.data?.filter((e) => e.isActive).length ?? null, [employees.data]);
  const pendingLeave = useMemo(
    () => leaveRequests.data?.filter((r) => r.status === "PENDING").length ?? null,
    [leaveRequests.data]
  );
  const attendanceRate = useMemo(() => {
    if (!attendance.data || !employees.data) return null;
    const now = new Date();
    const isToday = (d: Date) =>
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const activeIds = new Set(employees.data.filter((e) => e.isActive).map((e) => e.id));
    const present = new Set(attendance.data.filter((a) => isToday(new Date(a.clockIn)) && activeIds.has(a.employeeId)).map((a) => a.employeeId));
    return activeIds.size > 0 ? (present.size / activeIds.size) * 100 : 0;
  }, [attendance.data, employees.data]);
  const payroll = useMemo(() => {
    if (!payslips.data) return null;
    const now = new Date();
    const current = payslips.data.filter((p) => p.periodYear === now.getFullYear() && p.periodMonth === now.getMonth() + 1);
    return current.reduce((sum, p) => sum + Number(p.netPay), 0);
  }, [payslips.data]);

  const visibleCount = [canViewEmployees, canViewLeave, canViewAttendance, canViewPayroll].filter(Boolean).length;

  if (visibleCount === 0) {
    return <p className="text-sm text-muted-foreground">Aucun sous-module RH accessible.</p>;
  }

  return (
    <KpiGrid columns={Math.min(Math.max(visibleCount, 2), 4) as 2 | 3 | 4}>
      {canViewEmployees ? (
        activeCount !== null ? (
          <OverviewCard to="/hr/employees">
            <KpiCard icon={<Icons.IconUsers />} label="Effectif actif" value={activeCount} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewLeave ? (
        pendingLeave !== null ? (
          <OverviewCard to="/hr/leave">
            <KpiCard icon={<Icons.IconWarn />} iconTone={pendingLeave > 0 ? "gold" : "default"} label="Congés en attente" value={pendingLeave} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewAttendance ? (
        attendanceRate !== null ? (
          <OverviewCard to="/hr/attendance">
            <KpiCard
              icon={<Icons.IconTrend />}
              iconTone={attendanceRate >= 90 ? "good" : "gold"}
              label="Taux de présence (jour)"
              value={`${Math.round(attendanceRate)}%`}
            />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewPayroll ? (
        payroll !== null ? (
          <OverviewCard to="/hr/payroll">
            <KpiCard icon={<Icons.IconWallet />} label="Masse salariale (mois)" value={fmtGNF(payroll)} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}
    </KpiGrid>
  );
}
