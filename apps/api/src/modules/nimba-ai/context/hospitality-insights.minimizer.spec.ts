import { Prisma } from "@prisma/client";

import { HospitalityInsightsMinimizer } from "./hospitality-insights.minimizer";

function period(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    availableRooms: 2,
    availableRoomNights: 20,
    occupiedRoomNights: 10,
    occupancyRate: 0.5,
    totalRoomRevenue: new Prisma.Decimal("1000000"),
    adr: new Prisma.Decimal("100000"),
    revpar: new Prisma.Decimal("50000"),
    ...overrides,
  };
}

describe("HospitalityInsightsMinimizer", () => {
  it("convertit le taux en pourcentage lisible et les Decimal en string", () => {
    const minimizer = new HospitalityInsightsMinimizer();

    const minimized = minimizer.minimize({
      period: { dateFrom: new Date("2026-08-01T00:00:00.000Z"), dateTo: new Date("2026-08-11T00:00:00.000Z") },
      current: period(),
      previous: period({ occupancyRate: 0.3 }),
      reservationsByStatus: { CONFIRMED: 5, CANCELLED: 1 },
    });

    expect(minimized.current.occupancyRatePercent).toBe(50);
    expect(minimized.previous.occupancyRatePercent).toBe(30);
    expect(minimized.current.totalRoomRevenue).toBe("1000000");
    expect(minimized.current.adr).toBe("100000");
    expect(minimized.reservationsByStatus).toEqual({ CONFIRMED: 5, CANCELLED: 1 });
  });

  it("préserve null (jamais 0) quand la donnée sous-jacente est insuffisante", () => {
    const minimizer = new HospitalityInsightsMinimizer();

    const minimized = minimizer.minimize({
      period: { dateFrom: new Date("2026-08-01T00:00:00.000Z"), dateTo: new Date("2026-08-11T00:00:00.000Z") },
      current: period({ occupancyRate: null, adr: null, revpar: null }),
      previous: period(),
      reservationsByStatus: {},
    });

    expect(minimized.current.occupancyRatePercent).toBeNull();
    expect(minimized.current.adr).toBeNull();
    expect(minimized.current.revpar).toBeNull();
  });
});
