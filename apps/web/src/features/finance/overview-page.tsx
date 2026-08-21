import { fmtGNF } from "@nimbalodge/utils";
import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { useFinanceSummary } from "../../hooks/use-finance.js";
import { useInvoices } from "../../hooks/use-invoices.js";
import { usePermission } from "../../hooks/use-permission.js";
import { useActiveBudgetExecution } from "./use-active-budget-execution.js";

// Finance → Vue d'ensemble (`/finance`, index de FinanceLayout). Tableau de bord du module
// lui-même : pas le détail de chaque sous-module (déjà construit sur ses propres écrans), juste
// un KPI de synthèse par sous-module, chacun cliquable vers son écran détaillé. Réutilise
// exactement les mêmes sources que les sous-modules (GET /finance/summary,
// useActiveBudgetExecution partagée avec Budget/Dépenses, GET /invoices) — aucune nouvelle
// agrégation serveur.
function OverviewCard({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block rounded-xl transition-opacity hover:opacity-90">
      {children}
    </Link>
  );
}

export function FinanceOverviewPage() {
  const canViewSummary = usePermission("finance-summary.view");
  const canViewBudgets = usePermission("finance-budgets.view");
  const canViewInvoices = usePermission("finance-invoices.view");

  const summary = useFinanceSummary();
  const { activeBudget, summary: budgetSummary } = useActiveBudgetExecution();
  const invoices = useInvoices();

  const unpaid = useMemo(() => {
    if (!invoices.data) return null;
    const active = invoices.data.filter((i) => i.status !== "CANCELLED" && Number(i.dueBalance) > 0);
    return { count: active.length, amount: active.reduce((sum, i) => sum + Number(i.dueBalance), 0) };
  }, [invoices.data]);

  const visibleCount = (canViewSummary ? 3 : 0) + (canViewBudgets ? 1 : 0) + (canViewInvoices ? 1 : 0);

  if (!canViewSummary && !canViewBudgets && !canViewInvoices) {
    return <p className="text-sm text-muted-foreground">Aucun sous-module Finance accessible.</p>;
  }

  return (
    <KpiGrid columns={Math.min(Math.max(visibleCount, 2), 5) as 2 | 3 | 4 | 5}>
      {canViewSummary ? (
        summary.data ? (
          <OverviewCard to="/finance/revenues">
            <KpiCard icon={<Icons.IconTrend />} iconTone="good" label="Recettes du mois" value={fmtGNF(Number(summary.data.totalRevenue))} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewSummary ? (
        summary.data ? (
          <OverviewCard to="/finance/expenses">
            <KpiCard icon={<Icons.IconWallet />} iconTone="gold" label="Dépenses du mois" value={fmtGNF(Number(summary.data.totalExpense))} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewSummary ? (
        summary.data ? (
          <OverviewCard to="/finance/cash">
            <KpiCard
              icon={<Icons.IconWallet />}
              label="Solde caisse + banque"
              value={fmtGNF(Number(summary.data.cashBalance) + Number(summary.data.bankBalance))}
            />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewBudgets ? (
        <OverviewCard to="/finance/budgets">
          <KpiCard
            icon={<Icons.IconReport />}
            iconTone={!budgetSummary ? "default" : budgetSummary.executionRate > 100 ? "crit" : budgetSummary.executionRate >= 90 ? "gold" : "good"}
            label="Exécution budgétaire"
            value={budgetSummary ? `${Math.round(budgetSummary.executionRate)}%` : "—"}
            note={activeBudget ? activeBudget.name : "Aucun budget actif"}
          />
        </OverviewCard>
      ) : null}

      {canViewInvoices ? (
        unpaid ? (
          <OverviewCard to="/finance/invoices">
            <KpiCard
              icon={<Icons.IconWarn />}
              iconTone={unpaid.count > 0 ? "gold" : "default"}
              label="Impayés"
              value={fmtGNF(unpaid.amount)}
              note={`${unpaid.count} facture${unpaid.count > 1 ? "s" : ""}`}
            />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}
    </KpiGrid>
  );
}
