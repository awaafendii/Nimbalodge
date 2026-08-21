import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useDepartments } from "../../hooks/use-departments.js";
import { useEmployees } from "../../hooks/use-employees.js";
import { usePermission } from "../../hooks/use-permission.js";

// Dashboard du sous-module RH → Employés. Aucune donnée fabriquée : tout est dérivé de
// GET /employees, déjà chargé en entier pour EmployeesCard (voir index.tsx) — pas de nouvel
// endpoint.
export function EmployeesKpiBand() {
  const canView = usePermission("employees.view");
  const employees = useEmployees();
  const departments = useDepartments();

  const stats = useMemo(() => {
    if (!employees.data) return null;
    const now = new Date();
    const active = employees.data.filter((e) => e.isActive);
    const newThisMonth = employees.data.filter((e) => {
      if (!e.hireDate) return false;
      const d = new Date(e.hireDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    const byDepartment = new Map<string, number>();
    for (const e of active) {
      const key = e.departmentId ?? "__none__";
      byDepartment.set(key, (byDepartment.get(key) ?? 0) + 1);
    }

    return { total: employees.data.length, active: active.length, newThisMonth: newThisMonth.length, byDepartment };
  }, [employees.data]);

  if (!canView) return null;

  if (employees.isLoading || !stats) {
    return (
      <KpiGrid columns={3}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  const departmentRows = [...stats.byDepartment.entries()]
    .map(([id, count]) => ({
      id,
      name: id === "__none__" ? "Sans département" : (departments.data?.find((d) => d.id === id)?.name ?? "—"),
      count,
    }))
    .sort((a, b) => b.count - a.count);
  const departmentTotal = departmentRows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={3}>
        <KpiCard icon={<Icons.IconUsers />} label="Effectif total" value={stats.total} />
        <KpiCard icon={<Icons.IconUsers />} iconTone="good" label="Actifs" value={stats.active} />
        <KpiCard icon={<Icons.IconUsers />} label="Nouveaux ce mois-ci" value={stats.newThisMonth} />
      </KpiGrid>

      <Card>
        <CardHeader>
          <CardTitle>Répartition par département</CardTitle>
        </CardHeader>
        <CardContent>
          {departmentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun employé actif.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {departmentRows.map((row) => (
                <div key={row.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{row.name}</span>
                    <span className="tabular-nums text-muted-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-good"
                      style={{ width: `${departmentTotal > 0 ? (row.count / departmentTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
