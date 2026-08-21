import { fmtGNF } from "@nimbalodge/utils";
import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, KpiGrid, Skeleton } from "@nimbalodge/ui";
import { useMemo } from "react";

import { usePermission } from "../../hooks/use-permission.js";
import { useReservations } from "../../hooks/use-reservations.js";
import { useRoomTypes } from "../../hooks/use-room-types.js";
import { useRooms } from "../../hooks/use-rooms.js";

// Dashboard du sous-module Hébergement → Chambres. Taux d'occupation/ADR/RevPAR calculés côté
// client à partir de GET /rooms + GET /reservations (déjà chargés pour RoomsCard/ReservationsCard)
// — pas de nouvel endpoint. "Occupée aujourd'hui" = chambre couverte par une réservation
// CONFIRMED/CHECKED_IN dont la période [checkIn, checkOut) contient aujourd'hui — définition
// hôtelière standard, indépendante du fait que le check-in physique ait déjà été pointé.
export function RoomsKpiBand() {
  const canView = usePermission("rooms.view");
  const rooms = useRooms();
  const roomTypes = useRoomTypes();
  const reservations = useReservations();

  const stats = useMemo(() => {
    if (!rooms.data || !reservations.data) return null;
    const now = new Date();
    const activeRooms = rooms.data.filter((r) => r.isActive);

    const occupiedToday = reservations.data.filter((r) => {
      if (r.status !== "CONFIRMED" && r.status !== "CHECKED_IN") return false;
      const checkIn = new Date(r.checkInDate);
      const checkOut = new Date(r.checkOutDate);
      return checkIn <= now && now < checkOut;
    });
    const occupiedRoomIds = new Set(occupiedToday.map((r) => r.roomId));

    const totalRooms = activeRooms.length;
    const occupiedCount = occupiedRoomIds.size;
    const occupancyRate = totalRooms > 0 ? (occupiedCount / totalRooms) * 100 : 0;

    const dailyRevenue = occupiedToday.reduce((sum, r) => sum + Number(r.agreedRate), 0);
    const adr = occupiedToday.length > 0 ? dailyRevenue / occupiedToday.length : 0;
    const revPar = totalRooms > 0 ? dailyRevenue / totalRooms : 0;

    const roomTypeByRoomId = new Map(rooms.data.map((r) => [r.id, r.roomTypeId]));
    const byRoomType = new Map<string, number>();
    for (const roomId of occupiedRoomIds) {
      const typeId = roomTypeByRoomId.get(roomId);
      if (!typeId) continue;
      byRoomType.set(typeId, (byRoomType.get(typeId) ?? 0) + 1);
    }

    return { totalRooms, occupiedCount, occupancyRate, adr, revPar, byRoomType };
  }, [rooms.data, reservations.data]);

  if (!canView) return null;

  if (rooms.isLoading || reservations.isLoading || !stats) {
    return (
      <KpiGrid columns={3}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </KpiGrid>
    );
  }

  const typeRows = [...stats.byRoomType.entries()]
    .map(([id, count]) => ({ id, name: roomTypes.data?.find((t) => t.id === id)?.name ?? "—", count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={3}>
        <KpiCard
          icon={<Icons.IconBed />}
          iconTone={stats.occupancyRate >= 70 ? "good" : "gold"}
          label="Taux d'occupation"
          value={`${Math.round(stats.occupancyRate)}%`}
          note={`${stats.occupiedCount} / ${stats.totalRooms} chambres`}
        />
        <KpiCard icon={<Icons.IconWallet />} label="ADR (tarif moyen/jour)" value={fmtGNF(stats.adr)} />
        <KpiCard icon={<Icons.IconWallet />} label="RevPAR" value={fmtGNF(stats.revPar)} />
      </KpiGrid>

      {typeRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Chambres occupées par type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2.5">
              {typeRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{row.name}</span>
                  <span className="tabular-nums text-muted-foreground">{row.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
