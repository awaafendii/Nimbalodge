import { HrWorkforceMinimizer } from "./hr-workforce.minimizer";

describe("HrWorkforceMinimizer", () => {
  it("formate le taux d'absentéisme en pourcentage lisible", () => {
    const minimizer = new HrWorkforceMinimizer();

    const minimized = minimizer.minimize({
      period: { dateFrom: new Date("2026-08-01T00:00:00.000Z"), dateTo: new Date("2026-09-01T00:00:00.000Z") },
      headcount: 12,
      scheduledShifts: 40,
      attendedShifts: 36,
      absenteeismRate: 0.1,
      leaveRequestsByStatus: { APPROVED: 3 },
    });

    expect(minimized.absenteeismRatePercent).toBe(10);
    expect(minimized.headcount).toBe(12);
    expect(minimized.leaveRequestsByStatus).toEqual({ APPROVED: 3 });
  });

  it("préserve null quand aucun poste n'était planifié", () => {
    const minimizer = new HrWorkforceMinimizer();

    const minimized = minimizer.minimize({
      period: { dateFrom: new Date("2026-08-01T00:00:00.000Z"), dateTo: new Date("2026-09-01T00:00:00.000Z") },
      headcount: 0,
      scheduledShifts: 0,
      attendedShifts: 0,
      absenteeismRate: null,
      leaveRequestsByStatus: {},
    });

    expect(minimized.absenteeismRatePercent).toBeNull();
  });
});
