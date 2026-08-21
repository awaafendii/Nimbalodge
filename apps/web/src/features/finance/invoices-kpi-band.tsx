import { fmtGNF } from "@nimbalodge/utils";
import { Icons, KpiCard, KpiGrid, ModuleAlertBanner, Skeleton, type ModuleAlert } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useInvoices } from "../../hooks/use-invoices.js";
import { usePermission } from "../../hooks/use-permission.js";

// Dashboard du sous-module Finance → Facturation. Tout est dérivé de GET /invoices, déjà chargé en
// entier pour InvoicesCard (mêmes champs : grandTotal/amountPaid/dueBalance déjà calculés côté
// backend, InvoicesService — voir docs/architecture/phase-6-billing.md) — pas de nouvel endpoint.
export function InvoicesKpiBand() {
  const canView = usePermission("finance-invoices.view");
  const invoices = useInvoices();

  const stats = useMemo(() => {
    if (!invoices.data) return null;
    const now = new Date();
    const active = invoices.data.filter((i) => i.status !== "CANCELLED");
    const issuedOrBeyond = active.filter((i) => i.status !== "DRAFT");
    const paid = active.filter((i) => i.status === "PAID");
    const unpaid = active.filter((i) => Number(i.dueBalance) > 0);
    const overdue = unpaid.filter((i) => i.dueDate && new Date(i.dueDate) < now);

    const invoicedAmount = active.reduce((sum, i) => sum + Number(i.grandTotal), 0);
    const collectedAmount = active.reduce((sum, i) => sum + Number(i.amountPaid), 0);
    const unpaidAmount = unpaid.reduce((sum, i) => sum + Number(i.dueBalance), 0);

    return {
      issuedCount: issuedOrBeyond.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      unpaidAmount,
      invoicedAmount,
      collectedAmount,
      overdue,
    };
  }, [invoices.data]);

  if (!canView) return null;

  if (invoices.isLoading) {
    return (
      <KpiGrid columns={5}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  if (!stats) return null;

  const alerts: ModuleAlert[] = stats.overdue.map((invoice) => ({
    id: invoice.id,
    tone: "critical",
    message: `Facture ${invoice.invoiceNumber ?? invoice.id} en retard — ${invoice.clientName} : ${fmtGNF(Number(invoice.dueBalance))} impayé.`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={5}>
        <KpiCard icon={<Icons.IconInvoice />} label="Factures émises" value={stats.issuedCount} />
        <KpiCard icon={<Icons.IconInvoice />} iconTone="good" label="Factures payées" value={stats.paidCount} />
        <KpiCard
          icon={<Icons.IconWarn />}
          iconTone={stats.unpaidCount > 0 ? "gold" : "default"}
          label="Impayés"
          value={fmtGNF(stats.unpaidAmount)}
          note={`${stats.unpaidCount} facture${stats.unpaidCount > 1 ? "s" : ""}`}
        />
        <KpiCard icon={<Icons.IconWallet />} label="Montant facturé" value={fmtGNF(stats.invoicedAmount)} />
        <KpiCard icon={<Icons.IconWallet />} iconTone="good" label="Montant encaissé" value={fmtGNF(stats.collectedAmount)} />
      </KpiGrid>

      {alerts.length > 0 ? <ModuleAlertBanner alerts={alerts} /> : null}
    </div>
  );
}
