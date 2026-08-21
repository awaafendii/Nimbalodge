import { fmtGNF } from "@nimbalodge/utils";
import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, KpiGrid, ModuleAlertBanner, Skeleton, type ModuleAlert } from "@nimbalodge/ui";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { useBankAccounts } from "../../hooks/use-bank-accounts.js";
import { usePermission } from "../../hooks/use-permission.js";
import * as bankAccountsService from "../../services/bank-accounts.js";

// Dashboard du sous-module Finance → Banque. Même construction que CashKpiBand (Finance →
// Caisse) : solde actuel/d'ouverture viennent de GET /bank-accounts (balance déjà calculée côté
// backend), entrées/sorties/dernières opérations agrègent GET /bank-accounts/:id/transactions par
// compte actif — même endpoint et même queryKey que le dialogue "Transactions" existant, aucun
// nouvel endpoint. Pas de rapprochement bancaire : ce concept n'existe pas dans le backend
// (aucun modèle/champ de reconciliation) — omis plutôt qu'inventé, conformément à "si disponible".
export function BankKpiBand() {
  const canView = usePermission("finance-bank-accounts.view");
  const bankAccounts = useBankAccounts();
  const activeAccounts = useMemo(() => (bankAccounts.data ?? []).filter((a) => a.isActive), [bankAccounts.data]);

  const transactionQueries = useQueries({
    queries: activeAccounts.map((account) => ({
      queryKey: ["bank-accounts", account.id, "transactions"],
      queryFn: () => bankAccountsService.listBankTransactions(account.id),
    })),
  });
  const transactionsLoading = transactionQueries.some((q) => q.isLoading);

  const stats = useMemo(() => {
    if (transactionsLoading) return null;
    const now = new Date();
    const isSameMonth = (d: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

    let inflow = 0;
    let outflow = 0;
    const recent: { id: string; accountName: string; direction: string; label: string; amount: number; date: string }[] = [];

    activeAccounts.forEach((account, i) => {
      const transactions = transactionQueries[i]?.data ?? [];
      for (const tx of transactions) {
        const amount = Number(tx.amount);
        if (isSameMonth(new Date(tx.date))) {
          if (tx.direction === "IN") inflow += amount;
          else outflow += amount;
        }
        recent.push({ id: tx.id, accountName: account.name, direction: tx.direction, label: tx.label, amount, date: tx.date });
      }
    });
    recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const currentBalance = activeAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const openingBalance = activeAccounts.reduce((sum, a) => sum + Number(a.openingBalance), 0);
    const negativeAccounts = activeAccounts.filter((a) => Number(a.balance) < 0);

    return { currentBalance, openingBalance, inflow, outflow, recent: recent.slice(0, 5), negativeAccounts };
  }, [activeAccounts, transactionQueries, transactionsLoading]);

  if (!canView) return null;

  if (bankAccounts.isLoading || !stats) {
    return (
      <KpiGrid columns={4}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  const alerts: ModuleAlert[] = stats.negativeAccounts.map((a) => ({
    id: a.id,
    tone: "critical",
    message: `Solde négatif : ${a.name} (${fmtGNF(Number(a.balance))})`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={4}>
        <KpiCard icon={<Icons.IconWallet />} label="Solde bancaire" value={fmtGNF(stats.currentBalance)} />
        <KpiCard icon={<Icons.IconTrend />} iconTone="good" label="Entrées du mois" value={fmtGNF(stats.inflow)} />
        <KpiCard icon={<Icons.IconTrend />} iconTone="gold" label="Sorties du mois" value={fmtGNF(stats.outflow)} />
        <KpiCard icon={<Icons.IconWallet />} label="Solde d'ouverture" value={fmtGNF(stats.openingBalance)} />
      </KpiGrid>

      {alerts.length > 0 ? <ModuleAlertBanner alerts={alerts} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Dernières opérations</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune opération enregistrée.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {stats.recent.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{tx.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {tx.accountName} · {new Date(tx.date).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <span
                    className={`flex-none font-[var(--fw-subtitle-strong)] ${tx.direction === "IN" ? "text-good" : "text-critical"}`}
                  >
                    {tx.direction === "IN" ? "+" : "-"}
                    {fmtGNF(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
