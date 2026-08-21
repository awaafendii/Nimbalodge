import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { useReservations } from "../../hooks/use-reservations.js";
import { usePermission } from "../../hooks/use-permission.js";

// Dashboard du sous-module Hébergement → Réservations. Aucune donnée fabriquée : tout est dérivé
// de GET /reservations, déjà chargé en entier pour ReservationsCard — pas de nouvel endpoint.
function isToday(d: Date, now: Date) {
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function ReservationsKpiBand() {
  const canView = usePermission("reservations.view");
  const reservations = useReservations();

  const stats = useMemo(() => {
    if (!reservations.data) return null;
    const now = new Date();
    const active = reservations.data.filter((r) => r.status === "CONFIRMED" || r.status === "CHECKED_IN");
    const arrivals = reservations.data.filter(
      (r) => isToday(new Date(r.checkInDate), now) && (r.status === "CONFIRMED" || r.status === "CHECKED_IN")
    );
    const departures = reservations.data.filter(
      (r) => isToday(new Date(r.checkOutDate), now) && (r.status === "CHECKED_IN" || r.status === "CHECKED_OUT")
    );
    const cancelledThisMonth = reservations.data.filter((r) => {
      if (r.status !== "CANCELLED") return false;
      const d = new Date(r.checkInDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    return { active: active.length, arrivals: arrivals.length, departures: departures.length, cancelled: cancelledThisMonth.length };
  }, [reservations.data]);

  if (!canView) return null;

  if (reservations.isLoading || !stats) {
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
      <KpiCard icon={<Icons.IconInvoice />} label="Réservations actives" value={stats.active} />
      <KpiCard icon={<Icons.IconTrend />} iconTone="good" label="Arrivées aujourd'hui" value={stats.arrivals} />
      <KpiCard icon={<Icons.IconTrend />} iconTone="gold" label="Départs aujourd'hui" value={stats.departures} />
      <KpiCard icon={<Icons.IconWarn />} iconTone={stats.cancelled > 0 ? "gold" : "default"} label="Annulations ce mois-ci" value={stats.cancelled} />
    </KpiGrid>
  );
}
