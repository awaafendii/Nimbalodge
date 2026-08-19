import { Prisma } from "@prisma/client";

import { DepartmentInsightsMinimizer } from "../context/department-insights.minimizer";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { DepartmentInsightsTool } from "./department-insights.tool";
import type { ReportsService } from "../../reports/reports.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

// Unit — ReportsService mocké, DepartmentInsightsMinimizer réel. Vérifie que le Tool force
// toujours groupBy="department" (jamais un autre regroupement pour ce Tool précis) et ne suppose
// jamais un nom de département fixe (Restaurant/Spa/Bar) — les labels viennent uniquement de ce
// que ReportsService résout pour l'hôtel réel du demandeur.
describe("DepartmentInsightsTool", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const context: AiRequestContext = { user, permissions: new Set(["reports.financial.view"]), departmentIds: [] };

  function buildTool() {
    const reportsService = { financialReport: jest.fn() };
    const tool = new DepartmentInsightsTool(reportsService as unknown as ReportsService, new DepartmentInsightsMinimizer());
    return { tool, reportsService };
  }

  it("déclare la permission réelle qui gate déjà GET /reports/financial", () => {
    const { tool } = buildTool();
    expect(tool.requiredPermissions).toEqual(["reports.financial.view"]);
  });

  it("force toujours groupBy='department', quels que soient les filtres reçus", async () => {
    const { tool, reportsService } = buildTool();
    reportsService.financialReport.mockResolvedValue({
      period: { dateFrom: new Date("2026-08-01"), dateTo: new Date("2026-09-01") },
      rows: [],
      totals: { totalRevenue: new Prisma.Decimal(0), totalExpense: new Prisma.Decimal(0), net: new Prisma.Decimal(0) },
    });

    await tool.execute({ dateFrom: "2026-08-01", dateTo: "2026-09-01" }, context);

    expect(reportsService.financialReport).toHaveBeenCalledWith(
      { dateFrom: "2026-08-01", dateTo: "2026-09-01", groupBy: "department" },
      user
    );
  });

  it("renvoie des départements réels et dynamiques, jamais un nom d'hôtel type supposé (Restaurant/Spa/Bar)", async () => {
    const { tool, reportsService } = buildTool();
    reportsService.financialReport.mockResolvedValue({
      period: { dateFrom: new Date("2026-08-01"), dateTo: new Date("2026-09-01") },
      rows: [
        {
          key: "dept-42",
          label: "Blanchisserie", // label configuré par cet hôtel précis, pas un département "standard"
          totalRevenue: new Prisma.Decimal("50000"),
          totalExpense: new Prisma.Decimal("20000"),
          net: new Prisma.Decimal("30000"),
        },
      ],
      totals: { totalRevenue: new Prisma.Decimal("50000"), totalExpense: new Prisma.Decimal("20000"), net: new Prisma.Decimal("30000") },
    });

    const envelope = await tool.execute({}, context);

    expect(envelope.data.rows).toEqual([
      { departmentId: "dept-42", label: "Blanchisserie", totalRevenue: "50000", totalExpense: "20000", net: "30000" },
    ]);
  });
});
