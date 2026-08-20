import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, type ReservationStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";

// Même liste que RoomsService.hasOverlap()/available() — un statut hors de cette liste (CANCELLED,
// NO_SHOW) ne bloque jamais une chambre et ne doit donc jamais compter comme nuit occupée.
const BLOCKING_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface OccupancyPeriodResult {
  availableRooms: number;
  availableRoomNights: number;
  occupiedRoomNights: number;
  // null (jamais 0) quand availableRoomNights === 0 — un hôtel sans chambre active sur la période
  // n'a "aucune donnée exploitable", ce n'est pas la même chose que "0% d'occupation".
  occupancyRate: number | null;
  totalRoomRevenue: Prisma.Decimal;
  adr: Prisma.Decimal | null;
  revpar: Prisma.Decimal | null;
}

export interface HospitalityInsightsRaw {
  period: { dateFrom: Date; dateTo: Date };
  current: OccupancyPeriodResult;
  previous: OccupancyPeriodResult;
  reservationsByStatus: Partial<Record<ReservationStatus, number>>;
}

export interface HospitalityInsightsQuery {
  dateFrom?: string;
  dateTo?: string;
}

// Nimba AI (Étape 7) — aucune agrégation d'occupation/ADR/RevPAR n'existait dans le projet avant
// cette étape (confirmé par recherche préalable) : logique entièrement neuve, mais suit le même
// pattern de chevauchement demi-ouvert que RoomsService.hasOverlap()/available() (mêmes
// BLOCKING_STATUSES) plutôt que d'en inventer un différent. `Room`/`Reservation` n'ont pas de champ
// "statut d'occupation" stocké (commentaire schema.prisma explicite : toujours calculé à la
// demande) — cohérent avec le principe déjà établi ailleurs dans ce projet (soldes, totaux
// factures...) de ne jamais dénormaliser.
@Injectable()
export class HospitalityInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOccupancySummary(query: HospitalityInsightsQuery, requester: AuthenticatedUser): Promise<HospitalityInsightsRaw> {
    const now = new Date();
    const dateFrom = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dateTo = query.dateTo
      ? new Date(query.dateTo)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    if (dateFrom >= dateTo) {
      throw new BadRequestException("dateFrom doit être antérieure à dateTo");
    }

    const hotelWhere = requester.hotelId
      ? { hotelId: requester.hotelId }
      : { hotel: { organizationId: requester.organizationId } };

    const periodLengthMs = dateTo.getTime() - dateFrom.getTime();
    const previousDateFrom = new Date(dateFrom.getTime() - periodLengthMs);
    const previousDateTo = dateFrom;

    const [current, previous, statusGroups] = await Promise.all([
      this.computeOccupancy(hotelWhere, dateFrom, dateTo),
      this.computeOccupancy(hotelWhere, previousDateFrom, previousDateTo),
      this.prisma.reservation.groupBy({
        by: ["status"],
        where: { ...hotelWhere, checkInDate: { gte: dateFrom, lt: dateTo } },
        _count: { _all: true },
      }),
    ]);

    const reservationsByStatus: Partial<Record<ReservationStatus, number>> = {};
    for (const group of statusGroups) {
      reservationsByStatus[group.status] = group._count._all;
    }

    return { period: { dateFrom, dateTo }, current, previous, reservationsByStatus };
  }

  private async computeOccupancy(
    hotelWhere: { hotelId: string } | { hotel: { organizationId: string } },
    dateFrom: Date,
    dateTo: Date
  ): Promise<OccupancyPeriodResult> {
    const [availableRooms, overlapping] = await Promise.all([
      this.prisma.room.count({ where: { ...hotelWhere, isActive: true } }),
      this.prisma.reservation.findMany({
        where: {
          ...hotelWhere,
          status: { in: BLOCKING_STATUSES },
          checkInDate: { lt: dateTo },
          checkOutDate: { gt: dateFrom },
        },
        select: { checkInDate: true, checkOutDate: true, agreedRate: true },
      }),
    ]);

    const nightsInPeriod = Math.round((dateTo.getTime() - dateFrom.getTime()) / MS_PER_DAY);
    const availableRoomNights = availableRooms * nightsInPeriod;

    let occupiedRoomNights = 0;
    let totalRoomRevenue = new Prisma.Decimal(0);
    for (const reservation of overlapping) {
      const clippedStart = reservation.checkInDate > dateFrom ? reservation.checkInDate : dateFrom;
      const clippedEnd = reservation.checkOutDate < dateTo ? reservation.checkOutDate : dateTo;
      const nights = Math.max(0, Math.round((clippedEnd.getTime() - clippedStart.getTime()) / MS_PER_DAY));
      occupiedRoomNights += nights;
      totalRoomRevenue = totalRoomRevenue.plus(reservation.agreedRate.times(nights));
    }

    return {
      availableRooms,
      availableRoomNights,
      occupiedRoomNights,
      occupancyRate: availableRoomNights > 0 ? occupiedRoomNights / availableRoomNights : null,
      totalRoomRevenue,
      adr: occupiedRoomNights > 0 ? totalRoomRevenue.dividedBy(occupiedRoomNights) : null,
      revpar: availableRoomNights > 0 ? totalRoomRevenue.dividedBy(availableRoomNights) : null,
    };
  }
}
