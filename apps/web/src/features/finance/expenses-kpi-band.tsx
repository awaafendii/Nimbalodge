import { fmtGNF } from "@nimbalodge/utils";
import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, KpiGrid, ModuleAlertBanner, Skeleton, type ModuleAlert } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useDepartments } from "../../hooks/use-departments.js";
import { useExpenses, useFinancialCategories } from "../../hooks/use-finance-entries.js";
import { usePermission } from "../../hooks/use-permission.js";
import { computeTrend } from "./kpi-utils.js";
import { useActiveBudgetExecution } from "./use-active-budget-execution.js";

// Dashboard du sous-module Finance → Dépenses. Aucune donnée fabriquée : tout est dérivé de
// GET /expenses (déjà chargé en entier pour ExpensesCard) + des mêmes endpoints Budget déjà
// utilisés par BudgetsCard — pas de nouvel endpoint. "Réalisé" = statut PAID/BOOKED uniquement,
// même définition que FinanceSummaryService.getSummary() (montant réellement sorti, pas les
// brouillons/en attente).
const REALIZED_STATUSES = new Set(["PAID", "BOOKED"]);

function sumBy<T>(items: T[], keyOf: (item: T) => string, amountOf: (item: T) => number) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    totals.set(key, (totals.get(key) ?? 0) + amountOf(item));
  }
  return totals;
}

export function ExpensesKpiBand() {
  const canView = usePermission("finance-expenses.view");
  const canViewBudgets = usePermission("finance-budgets.view");

  const expenses = useExpenses();
  const categories = useFinancialCategories();
  const departments = useDepartments();

  const { summary: budgetSummary } = useActiveBudgetExecution();

  const overspentAlerts = useMemo<ModuleAlert[]>(() => {
    if (!budgetSummary) return [];
    return budgetSummary.overspentLines.map((line) => ({
      id: line.lineId,
      tone: "critical" as const,
      message: `Dépassement budgétaire : ${fmtGNF(Number(line.actual))} réalisé pour ${fmtGNF(Number(line.planned))} prévu.`,
    }));
  }, [budgetSummary]);

  const stats = useMemo(() => {
    if (!expenses.data) return null;
    const now = new Date();
    const isSameMonth = (d: Date, monthOffset: number) => {
      const ref = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
    };

    const realized = expenses.data.filter((e) => REALIZED_STATUSES.has(e.status));
    const thisMonthRealized = realized.filter((e) => isSameMonth(new Date(e.date), 0));
    const lastMonthRealized = realized.filter((e) => isSameMonth(new Date(e.date), -1));
    const pending = expenses.data.filter((e) => e.status === "PENDING");

    const thisMonthTotal = thisMonthRealized.reduce((sum, e) => sum + Number(e.amount), 0);
    const lastMonthTotal = lastMonthRealized.reduce((sum, e) => sum + Number(e.amount), 0);
    const pendingTotal = pending.reduce((sum, e) => sum + Number(e.amount), 0);

    const byCategory = sumBy(
      thisMonthRealized,
      (e) => e.categoryId,
      (e) => Number(e.amount)
    );
    const byDepartment = sumBy(
      thisMonthRealized,
      (e) => e.departmentId ?? "__none__",
      (e) => Number(e.amount)
    );

    return { thisMonthTotal, lastMonthTotal, pendingCount: pending.length, pendingTotal, byCategory, byDepartment };
  }, [expenses.data]);

  if (!canView) return null;

  if (expenses.isLoading) {
    return (
      <KpiGrid columns={2}>
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  if (!stats) return null;

  const categoryRows = [...stats.byCategory.entries()]
    .map(([id, amount]) => ({ id, name: categories.data?.find((c) => c.id === id)?.name ?? "—", amount }))
    .sort((a, b) => b.amount - a.amount);
  const categoryTotal = categoryRows.reduce((sum, row) => sum + row.amount, 0);

  const departmentRows = [...stats.byDepartment.entries()]
    .map(([id, amount]) => ({
      id,
      name: id === "__none__" ? "Sans département" : (departments.data?.find((d) => d.id === id)?.name ?? "—"),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
  const departmentTotal = departmentRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={2}>
        <KpiCard
          icon={<Icons.IconWallet />}
          iconTone="gold"
          label="Dépenses du mois (réalisées)"
          value={fmtGNF(stats.thisMonthTotal)}
          delta={computeTrend(stats.thisMonthTotal, stats.lastMonthTotal, false)}
        />
        <KpiCard
          icon={<Icons.IconWarn />}
          iconTone={stats.pendingCount > 0 ? "gold" : "default"}
          label="Dépenses en attente"
          value={fmtGNF(stats.pendingTotal)}
          note={`${stats.pendingCount} dépense${stats.pendingCount > 1 ? "s" : ""} à traiter`}
        />
      </KpiGrid>

      {canViewBudgets && overspentAlerts.length > 0 ? <ModuleAlertBanner alerts={overspentAlerts} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Par catégorie — ce mois-ci</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune dépense réalisée ce mois-ci.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {categoryRows.map((row) => (
                  <div key={row.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{row.name}</span>
                      <span className="tabular-nums text-muted-foreground">{fmtGNF(row.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-brand-gold"
                        style={{ width: `${categoryTotal > 0 ? (row.amount / categoryTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Par département — ce mois-ci</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune dépense réalisée ce mois-ci.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {departmentRows.map((row) => (
                  <div key={row.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{row.name}</span>
                      <span className="tabular-nums text-muted-foreground">{fmtGNF(row.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-brand-gold"
                        style={{ width: `${departmentTotal > 0 ? (row.amount / departmentTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
