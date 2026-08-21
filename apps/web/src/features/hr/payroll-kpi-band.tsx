import { fmtGNF } from "@nimbalodge/utils";
import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { usePayslips } from "../../hooks/use-payslips.js";
import { usePermission } from "../../hooks/use-permission.js";

const PENDING_STATUSES = new Set(["DRAFT", "FINALIZED"]);

// Dashboard du sous-module RH → Paie. Aucune donnée fabriquée : tout est dérivé de GET /payslips,
// déjà chargé en entier pour PayslipsCard — pas de nouvel endpoint. Scope = période courante
// (periodYear/periodMonth du bulletin, pas sa date de création).
export function PayrollKpiBand() {
  const canView = usePermission("payslips.view");
  const payslips = usePayslips();

  const stats = useMemo(() => {
    if (!payslips.data) return null;
    const now = new Date();
    const currentPeriod = payslips.data.filter(
      (p) => p.periodYear === now.getFullYear() && p.periodMonth === now.getMonth() + 1
    );
    const paid = currentPeriod.filter((p) => p.status === "PAID");
    const pending = currentPeriod.filter((p) => PENDING_STATUSES.has(p.status));
    const massSalariale = currentPeriod.reduce((sum, p) => sum + Number(p.netPay), 0);

    return { generated: currentPeriod.length, paid: paid.length, pending: pending.length, massSalariale };
  }, [payslips.data]);

  if (!canView) return null;

  if (payslips.isLoading || !stats) {
    return (
      <KpiGrid columns={4}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  return (
    <KpiGrid columns={4}>
      <KpiCard icon={<Icons.IconWallet />} label="Masse salariale (mois)" value={fmtGNF(stats.massSalariale)} />
      <KpiCard icon={<Icons.IconReport />} label="Bulletins générés" value={stats.generated} />
      <KpiCard icon={<Icons.IconReport />} iconTone="good" label="Bulletins payés" value={stats.paid} />
      <KpiCard icon={<Icons.IconWarn />} iconTone={stats.pending > 0 ? "gold" : "default"} label="Bulletins en attente" value={stats.pending} />
    </KpiGrid>
  );
}
