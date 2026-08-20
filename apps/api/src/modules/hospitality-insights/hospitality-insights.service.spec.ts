import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../database/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { HospitalityInsightsService } from "./hospitality-insights.service";

// Unit — Prisma entièrement mocké. Couvre le calcul d'occupation/ADR/RevPAR neuf (aucune logique
// existante à réutiliser, voir commentaire du service) : chevauchement demi-ouvert identique à
// RoomsService, exclusion des statuts non bloquants, clipping aux bornes de la période, et surtout
// le renvoi de `null` (jamais 0 ou NaN) quand la donnée est structurellement insuffisante — un
// hôtel sans chambre active ne doit jamais afficher "0% d'occupation" comme si c'était un fait
// mesuré.
describe("HospitalityInsightsService", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = "2026-08-01T00:00:00.000Z";
  const dateTo = "2026-08-11T00:00:00.000Z"; // 10 nuits

  function buildService(options: {
    roomCount: number;
    reservations: { checkInDate: string; checkOutDate: string; agreedRate: string }[];
    previousRoomCount?: number;
    previousReservations?: { checkInDate: string; checkOutDate: string; agreedRate: string }[];
    statusGroups?: { status: string; _count: { _all: number } }[];
  }) {
    const prisma = {
      room: { count: jest.fn() },
      reservation: { findMany: jest.fn(), groupBy: jest.fn() },
    };

    prisma.room.count.mockImplementation(({ where }: { where: { hotelId?: string } }) => {
      // Le service appelle count() pour la période courante puis la précédente (ordre non garanti
      // par Promise.all) — on ne peut distinguer les deux par le `where`, identique dans les deux
      // cas (le scope hôtel, pas la période). On renvoie donc la même valeur aux deux appels sauf
      // si un test a explicitement besoin de les différencier (previousRoomCount).
      return Promise.resolve(prisma.room.count.mock.calls.length <= 1 ? options.roomCount : (options.previousRoomCount ?? options.roomCount));
    });

    prisma.reservation.findMany.mockImplementation(({ where }: { where: { checkInDate: { lt: Date }; checkOutDate: { gt: Date } } }) => {
      // Distingue période courante vs précédente par la borne `checkInDate.lt` demandée.
      const isCurrentPeriod = where.checkInDate.lt.toISOString() === dateTo;
      const rows = isCurrentPeriod ? options.reservations : (options.previousReservations ?? []);
      return Promise.resolve(
        rows.map((r) => ({
          checkInDate: new Date(r.checkInDate),
          checkOutDate: new Date(r.checkOutDate),
          agreedRate: new Prisma.Decimal(r.agreedRate),
        }))
      );
    });

    prisma.reservation.groupBy.mockResolvedValue(options.statusGroups ?? []);

    const service = new HospitalityInsightsService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  it("rejette dateFrom >= dateTo", async () => {
    const { service } = buildService({ roomCount: 5, reservations: [] });
    await expect(service.getOccupancySummary({ dateFrom: dateTo, dateTo: dateFrom }, user)).rejects.toThrow(
      BadRequestException
    );
  });

  it("calcule occupation/ADR/RevPAR pour une réservation couvrant exactement la période", async () => {
    const { service } = buildService({
      roomCount: 2, // 2 chambres actives × 10 nuits = 20 nuits disponibles
      reservations: [{ checkInDate: dateFrom, checkOutDate: dateTo, agreedRate: "100000" }],
    });

    const result = await service.getOccupancySummary({ dateFrom, dateTo }, user);

    expect(result.current.availableRoomNights).toBe(20);
    expect(result.current.occupiedRoomNights).toBe(10); // 1 réservation × 10 nuits
    expect(result.current.occupancyRate).toBeCloseTo(0.5);
    expect(result.current.totalRoomRevenue.toString()).toBe("1000000"); // 100000 × 10 nuits
    expect(result.current.adr?.toString()).toBe("100000"); // revenu / nuits occupées
    expect(result.current.revpar?.toString()).toBe("50000"); // revenu / nuits disponibles
  });

  it("découpe (clip) une réservation qui déborde des bornes de la période", async () => {
    const { service } = buildService({
      roomCount: 1,
      reservations: [
        // Arrivée 3 jours avant le début de période, départ 3 jours après la fin — seules les 10
        // nuits de la période elle-même doivent compter, jamais les 16 nuits réelles du séjour.
        { checkInDate: "2026-07-29T00:00:00.000Z", checkOutDate: "2026-08-14T00:00:00.000Z", agreedRate: "50000" },
      ],
    });

    const result = await service.getOccupancySummary({ dateFrom, dateTo }, user);

    expect(result.current.occupiedRoomNights).toBe(10);
    expect(result.current.totalRoomRevenue.toString()).toBe("500000");
  });

  it("exclut les réservations CANCELLED/NO_SHOW de l'occupation (le filtre Prisma s'en charge, jamais recompté ici)", async () => {
    // Le mock ne renvoie que ce que le `where` de Prisma aurait dû filtrer (status IN
    // BLOCKING_STATUSES) — ce test documente l'attente plutôt que de la re-tester au niveau SQL.
    const { service, prisma } = buildService({ roomCount: 1, reservations: [] });

    await service.getOccupancySummary({ dateFrom, dateTo }, user);

    const findManyCall = prisma.reservation.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toEqual({ in: ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] });
  });

  it("renvoie null (jamais 0/NaN) quand aucune chambre active n'existe sur la période", async () => {
    const { service } = buildService({ roomCount: 0, reservations: [] });

    const result = await service.getOccupancySummary({ dateFrom, dateTo }, user);

    expect(result.current.availableRoomNights).toBe(0);
    expect(result.current.occupancyRate).toBeNull();
    expect(result.current.revpar).toBeNull();
  });

  it("renvoie adr=null (jamais 0) quand aucune nuit n'est occupée, mais occupancyRate=0 (donnée réelle, pas absente)", async () => {
    const { service } = buildService({ roomCount: 3, reservations: [] });

    const result = await service.getOccupancySummary({ dateFrom, dateTo }, user);

    expect(result.current.occupancyRate).toBe(0);
    expect(result.current.adr).toBeNull();
  });

  it("compare toujours à la période précédente de même durée", async () => {
    const { service } = buildService({
      roomCount: 2,
      reservations: [{ checkInDate: dateFrom, checkOutDate: dateTo, agreedRate: "100000" }],
      previousReservations: [],
    });

    const result = await service.getOccupancySummary({ dateFrom, dateTo }, user);

    expect(result.previous.occupancyRate).toBe(0);
    expect(result.current.occupancyRate).toBeCloseTo(0.5);
  });

  it("expose la répartition des réservations par statut, y compris CANCELLED/NO_SHOW", async () => {
    const { service } = buildService({
      roomCount: 1,
      reservations: [],
      statusGroups: [
        { status: "CONFIRMED", _count: { _all: 3 } },
        { status: "CANCELLED", _count: { _all: 2 } },
      ],
    });

    const result = await service.getOccupancySummary({ dateFrom, dateTo }, user);

    expect(result.reservationsByStatus).toEqual({ CONFIRMED: 3, CANCELLED: 2 });
  });
});
