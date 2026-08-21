import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useGuests } from "../../hooks/use-guests.js";
import { usePermission } from "../../hooks/use-permission.js";

// Dashboard du sous-module Hébergement → Clients. Aucune donnée fabriquée : tout est dérivé de
// GET /guests, déjà chargé en entier pour GuestsCard — pas de nouvel endpoint.
export function GuestsKpiBand() {
  const canView = usePermission("guests.view");
  const guests = useGuests();

  const stats = useMemo(() => {
    if (!guests.data) return null;
    const now = new Date();
    const active = guests.data.filter((g) => g.isActive);
    const newThisMonth = guests.data.filter((g) => {
      const d = new Date(g.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return { total: guests.data.length, active: active.length, newThisMonth: newThisMonth.length };
  }, [guests.data]);

  if (!canView) return null;

  if (guests.isLoading || !stats) {
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
      <KpiCard icon={<Icons.IconUsers />} label="Total clients" value={stats.total} />
      <KpiCard icon={<Icons.IconUsers />} iconTone="good" label="Actifs" value={stats.active} />
      <KpiCard icon={<Icons.IconUsers />} label="Nouveaux ce mois-ci" value={stats.newThisMonth} />
    </KpiGrid>
  );
}
