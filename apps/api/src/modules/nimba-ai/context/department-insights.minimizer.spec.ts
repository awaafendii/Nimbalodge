import { Prisma } from "@prisma/client";

import { DepartmentInsightsMinimizer } from "./department-insights.minimizer";

describe("DepartmentInsightsMinimizer", () => {
  it("convertit les lignes et totaux en string, et renomme key en departmentId", () => {
    const minimizer = new DepartmentInsightsMinimizer();

    const minimized = minimizer.minimize({
      period: { dateFrom: new Date("2026-08-01T00:00:00.000Z"), dateTo: new Date("2026-09-01T00:00:00.000Z") },
      rows: [
        {
          key: "dept-restaurant",
          label: "Restaurant",
          totalRevenue: new Prisma.Decimal("800000"),
          totalExpense: new Prisma.Decimal("300000"),
          net: new Prisma.Decimal("500000"),
        },
      ],
      totals: {
        totalRevenue: new Prisma.Decimal("800000"),
        totalExpense: new Prisma.Decimal("300000"),
        net: new Prisma.Decimal("500000"),
      },
    });

    expect(minimized).toEqual({
      period: { from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
      rows: [{ departmentId: "dept-restaurant", label: "Restaurant", totalRevenue: "800000", totalExpense: "300000", net: "500000" }],
      totals: { totalRevenue: "800000", totalExpense: "300000", net: "500000" },
    });
  });

  it("gère une liste de départements vide sans erreur (hôtel sans données sur la période)", () => {
    const minimizer = new DepartmentInsightsMinimizer();

    const minimized = minimizer.minimize({
      period: { dateFrom: new Date("2026-08-01T00:00:00.000Z"), dateTo: new Date("2026-09-01T00:00:00.000Z") },
      rows: [],
      totals: { totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(0), net: new Prisma.Decimal(0) },
    });

    expect(minimized.rows).toEqual([]);
    expect(minimized.totals).toEqual({ totalRevenue: "0", totalExpense: "0", net: "0" });
  });
});
