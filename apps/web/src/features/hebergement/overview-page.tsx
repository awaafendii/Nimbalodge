import { Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { useGuests } from "../../hooks/use-guests.js";
import { usePermission } from "../../hooks/use-permission.js";
import { useReservations } from "../../hooks/use-reservations.js";
import { useRooms } from "../../hooks/use-rooms.js";

// Hébergement → Vue d'ensemble (`/hebergement`), même principe que Finance/RH : un KPI de
// synthèse par sous-module, cliquable vers son écran détaillé. Réutilise les mêmes sources que les
// sous-modules, aucune nouvelle agrégation serveur.
function OverviewCard({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block rounded-xl transition-opacity hover:opacity-90">
      {children}
    </Link>
  );
}

export function HebergementOverviewPage() {
  const canViewReservations = usePermission("reservations.view");
  const canViewRooms = usePermission("rooms.view");
  const canViewGuests = usePermission("guests.view");

  const reservations = useReservations();
  const rooms = useRooms();
  const guests = useGuests();

  const arrivalsToday = useMemo(() => {
    if (!reservations.data) return null;
    const now = new Date();
    return reservations.data.filter((r) => {
      const d = new Date(r.checkInDate);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate() &&
        (r.status === "CONFIRMED" || r.status === "CHECKED_IN")
      );
    }).length;
  }, [reservations.data]);

  const occupancyRate = useMemo(() => {
    if (!reservations.data || !rooms.data) return null;
    const now = new Date();
    const activeRooms = rooms.data.filter((r) => r.isActive);
    const occupiedRoomIds = new Set(
      reservations.data
        .filter((r) => {
          if (r.status !== "CONFIRMED" && r.status !== "CHECKED_IN") return false;
          return new Date(r.checkInDate) <= now && now < new Date(r.checkOutDate);
        })
        .map((r) => r.roomId)
    );
    return activeRooms.length > 0 ? (occupiedRoomIds.size / activeRooms.length) * 100 : 0;
  }, [reservations.data, rooms.data]);

  const activeGuests = useMemo(() => guests.data?.filter((g) => g.isActive).length ?? null, [guests.data]);

  const visibleCount = [canViewReservations, canViewRooms, canViewGuests].filter(Boolean).length;

  if (visibleCount === 0) {
    return <p className="text-sm text-muted-foreground">Aucun sous-module Hébergement accessible.</p>;
  }

  return (
    <KpiGrid columns={Math.min(Math.max(visibleCount, 2), 3) as 2 | 3}>
      {canViewReservations ? (
        arrivalsToday !== null ? (
          <OverviewCard to="/hebergement/reservations">
            <KpiCard icon={<Icons.IconInvoice />} iconTone="good" label="Arrivées aujourd'hui" value={arrivalsToday} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewRooms ? (
        occupancyRate !== null ? (
          <OverviewCard to="/hebergement/rooms">
            <KpiCard
              icon={<Icons.IconBed />}
              iconTone={occupancyRate >= 70 ? "good" : "gold"}
              label="Taux d'occupation"
              value={`${Math.round(occupancyRate)}%`}
            />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}

      {canViewGuests ? (
        activeGuests !== null ? (
          <OverviewCard to="/hebergement/guests">
            <KpiCard icon={<Icons.IconUsers />} label="Clients actifs" value={activeGuests} />
          </OverviewCard>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : null}
    </KpiGrid>
  );
}
