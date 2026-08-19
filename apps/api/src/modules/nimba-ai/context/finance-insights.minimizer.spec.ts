import { Prisma } from "@prisma/client";

import { FinanceInsightsMinimizer } from "./finance-insights.minimizer";

describe("FinanceInsightsMinimizer", () => {
  it("convertit tous les montants Decimal en string, jamais en number", () => {
    const minimizer = new FinanceInsightsMinimizer();

    const minimized = minimizer.minimize({
      period: { year: 2026, month: 8 },
      totalRevenue: new Prisma.Decimal("1250000.50"),
      totalExpense: new Prisma.Decimal("430000"),
      cashBalance: new Prisma.Decimal("500000"),
      bankBalance: new Prisma.Decimal("2000000.75"),
    });

    expect(minimized).toEqual({
      period: { year: 2026, month: 8 },
      totalRevenue: "1250000.5",
      totalExpense: "430000",
      cashBalance: "500000",
      bankBalance: "2000000.75",
    });
    expect(typeof minimized.totalRevenue).toBe("string");
  });
});
