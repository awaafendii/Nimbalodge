import { Prisma } from "@prisma/client";

import type { ReportsService } from "../../reports/reports.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { RevenueExpenseTrendDetector } from "./revenue-expense-trend.detector";

describe("RevenueExpenseTrendDetector", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = new Date("2026-08-01T00:00:00Z");
  const dateTo = new Date("2026-09-01T00:00:00Z");

  function buildDetector() {
    const reportsService = { financialReport: jest.fn() };
    const detector = new RevenueExpenseTrendDetector(reportsService as unknown as ReportsService);
    return { detector, reportsService };
  }

  it("signale une hausse de dépenses et une baisse de recettes >= 20% par catégorie", async () => {
    const { detector, reportsService } = buildDetector();
    reportsService.financialReport
      .mockResolvedValueOnce({
        rows: [
          { key: "cat-1", label: "Fournitures", totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(1500) },
          { key: "cat-2", label: "Hébergement", totalRevenue: new Prisma.Decimal(4000), totalExpense: new Prisma.Decimal(0) },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { key: "cat-1", label: "Fournitures", totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(1000) },
          { key: "cat-2", label: "Hébergement", totalRevenue: new Prisma.Decimal(8000), totalExpense: new Prisma.Decimal(0) },
        ],
      });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toHaveLength(2);
    expect(result.find((a) => a.resourceId === "cat-1")).toMatchObject({ indicator: "Dépenses — Fournitures" });
    expect(result.find((a) => a.resourceId === "cat-2")).toMatchObject({ indicator: "Recettes — Hébergement" });
  });

  it("ignore une catégorie sans référence sur la période précédente", async () => {
    const { detector, reportsService } = buildDetector();
    reportsService.financialReport
      .mockResolvedValueOnce({ rows: [{ key: "cat-new", label: "Nouvelle", totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(5000) }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
  });

  it("ignore un écart sous le seuil de 20%", async () => {
    const { detector, reportsService } = buildDetector();
    reportsService.financialReport
      .mockResolvedValueOnce({ rows: [{ key: "cat-1", label: "Fournitures", totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(1050) }] })
      .mockResolvedValueOnce({ rows: [{ key: "cat-1", label: "Fournitures", totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(1000) }] });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
  });
});
