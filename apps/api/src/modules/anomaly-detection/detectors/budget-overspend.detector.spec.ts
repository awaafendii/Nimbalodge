import { Prisma } from "@prisma/client";

import type { BudgetsService } from "../../budgets/budgets.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { BudgetOverspendDetector } from "./budget-overspend.detector";

describe("BudgetOverspendDetector", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = new Date("2026-08-01T00:00:00Z");
  const dateTo = new Date("2026-09-01T00:00:00Z");

  function buildDetector() {
    const budgetsService = { list: jest.fn(), getExecution: jest.fn() };
    const detector = new BudgetOverspendDetector(budgetsService as unknown as BudgetsService);
    return { detector, budgetsService };
  }

  it("signale une ligne EXPENSE dont le réalisé dépasse le prévu", async () => {
    const { detector, budgetsService } = buildDetector();
    budgetsService.list.mockResolvedValue([
      { id: "budget-1", name: "Budget 2026", isActive: true, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
    ]);
    budgetsService.getExecution.mockResolvedValue({
      startDate: dateFrom,
      endDate: dateTo,
      lines: [
        { lineId: "line-1", type: "EXPENSE", planned: new Prisma.Decimal(1000), actual: new Prisma.Decimal(1500) },
        { lineId: "line-2", type: "REVENUE", planned: new Prisma.Decimal(500), actual: new Prisma.Decimal(2000) },
        { lineId: "line-3", type: "EXPENSE", planned: new Prisma.Decimal(1000), actual: new Prisma.Decimal(800) },
      ],
    });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ resourceType: "budget-line", resourceId: "line-1", severity: "high" });
  });

  it("ignore les budgets inactifs et hors période", async () => {
    const { detector, budgetsService } = buildDetector();
    budgetsService.list.mockResolvedValue([
      { id: "budget-1", name: "Inactif", isActive: false, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
      { id: "budget-2", name: "Hors période", isActive: true, startDate: new Date("2020-01-01"), endDate: new Date("2020-12-31") },
    ]);

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
    expect(budgetsService.getExecution).not.toHaveBeenCalled();
  });
});
