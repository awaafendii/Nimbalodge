import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useLeaveRequests } from "../../hooks/use-leave-requests.js";
import { usePermission } from "../../hooks/use-permission.js";

// Dashboard du sous-module RH → Congés. Aucune donnée fabriquée : tout est dérivé de
// GET /leave-requests, déjà chargé en entier pour LeaveRequestsCard — pas de nouvel endpoint.
// Approuvés/refusés = totaux cumulés (pas de champ "décidé le" distinct de `approvedAt`, qui n'est
// renseigné que pour les approbations — impossible de borner "refusés" à une période sans
// l'inventer, donc affiché en cumul plutôt qu'un chiffre mensuel trompeur).
export function LeaveKpiBand() {
  const canView = usePermission("leave-requests.view");
  const leaveRequests = useLeaveRequests();

  const stats = useMemo(() => {
    if (!leaveRequests.data) return null;
    const now = new Date();
    const pending = leaveRequests.data.filter((r) => r.status === "PENDING");
    const approved = leaveRequests.data.filter((r) => r.status === "APPROVED");
    const rejected = leaveRequests.data.filter((r) => r.status === "REJECTED");
    const ongoing = approved.filter((r) => new Date(r.startDate) <= now && now <= new Date(r.endDate));

    return { pending: pending.length, approved: approved.length, rejected: rejected.length, ongoing: ongoing.length };
  }, [leaveRequests.data]);

  if (!canView) return null;

  if (leaveRequests.isLoading || !stats) {
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
      <KpiCard
        icon={<Icons.IconWarn />}
        iconTone={stats.pending > 0 ? "gold" : "default"}
        label="Demandes en attente"
        value={stats.pending}
      />
      <KpiCard icon={<Icons.IconUsers />} iconTone="good" label="Approuvées (cumul)" value={stats.approved} />
      <KpiCard icon={<Icons.IconUsers />} iconTone="crit" label="Refusées (cumul)" value={stats.rejected} />
      <KpiCard icon={<Icons.IconUsers />} label="En congé actuellement" value={stats.ongoing} />
    </KpiGrid>
  );
}
