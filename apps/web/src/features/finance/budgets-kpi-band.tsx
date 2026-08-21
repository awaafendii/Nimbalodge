import { fmtGNF } from "@nimbalodge/utils";
import { Card, CardContent, Icons, KpiCard, KpiGrid, ModuleAlertBanner, Skeleton, type ModuleAlert } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useDepartments } from "../../hooks/use-departments.js";
import { useFinancialCategories } from "../../hooks/use-finance-entries.js";
import { usePermission } from "../../hooks/use-permission.js";
import { useActiveBudgetExecution } from "./use-active-budget-execution.js";

// Dashboard du sous-module Finance → Budget. Prévu/réalisé/taux d'exécution/écart/lignes en
// dépassement viennent de useActiveBudgetExecution() (partagée avec Dépenses et le tableau de
// bord Finance global) — elle-même dérivée de GET /budgets/:id/execution, même endpoint que
// "Voir l'exécution" dans BudgetsCard. Pas de nouvel endpoint.
export function BudgetsKpiBand() {
  const canView = usePermission("finance-budgets.view");
  const { budgetsLoading, activeBudget, executionLoading, summary } = useActiveBudgetExecution();
  const categories = useFinancialCategories();
  const departments = useDepartments();

  const overspentAlerts = useMemo<ModuleAlert[]>(() => {
    if (!summary) return [];
    return summary.overspentLines.map((line) => {
      const parts = [
        line.departmentId ? departments.data?.find((d) => d.id === line.departmentId)?.name : null,
        line.categoryId ? categories.data?.find((c) => c.id === line.categoryId)?.name : null,
      ].filter(Boolean);
      return {
        id: line.lineId,
        tone: "critical" as const,
        message: `${parts.length > 0 ? parts.join(" — ") : "Ligne budgétaire"} : ${fmtGNF(Number(line.actual))} réalisé pour ${fmtGNF(Number(line.planned))} prévu.`,
      };
    });
  }, [summary, departments.data, categories.data]);

  if (!canView) return null;

  if (budgetsLoading) {
    return (
      <KpiGrid columns={4}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  if (!activeBudget) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Aucun budget actif sur la période en cours.
        </CardContent>
      </Card>
    );
  }

  if (executionLoading || !summary) {
    return (
      <KpiGrid columns={4}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Budget actif : <span className="font-[var(--fw-subtitle-strong)] text-foreground">{activeBudget.name}</span>
      </p>
      <KpiGrid columns={4}>
        <KpiCard icon={<Icons.IconReport />} label="Prévu" value={fmtGNF(summary.planned)} />
        <KpiCard icon={<Icons.IconWallet />} label="Réalisé" value={fmtGNF(summary.actual)} />
        <KpiCard
          icon={<Icons.IconTrend />}
          iconTone={summary.executionRate > 100 ? "crit" : summary.executionRate >= 90 ? "gold" : "good"}
          label="Taux d'exécution"
          value={`${Math.round(summary.executionRate)}%`}
        />
        <KpiCard
          icon={<Icons.IconWallet />}
          iconTone={summary.variance < 0 ? "crit" : "default"}
          label="Écart (prévu − réalisé)"
          value={fmtGNF(summary.variance)}
        />
      </KpiGrid>

      {overspentAlerts.length > 0 ? <ModuleAlertBanner alerts={overspentAlerts} /> : null}
    </div>
  );
}
