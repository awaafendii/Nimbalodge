import { Prisma } from "@prisma/client";

import { FinanceInsightsMinimizer } from "../context/finance-insights.minimizer";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { FinanceInsightsTool } from "./finance-insights.tool";
import type { FinanceSummaryService } from "../../finance-summary/finance-summary.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

// Unit — FinanceSummaryService mocké, FinanceInsightsMinimizer réel (pur, aucune raison de le
// mocker). Vérifie que le Tool délègue au service métier réel avec le vrai AuthenticatedUser
// (aucune requête Prisma directe dans le Tool) et renvoie une enveloppe {data, provenance}.
describe("FinanceInsightsTool", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const context: AiRequestContext = { user, permissions: new Set(["finance-summary.view"]), departmentIds: [] };

  function buildTool() {
    const financeSummaryService = { getSummary: jest.fn() };
    const tool = new FinanceInsightsTool(
      financeSummaryService as unknown as FinanceSummaryService,
      new FinanceInsightsMinimizer()
    );
    return { tool, financeSummaryService };
  }

  it("déclare la permission réelle qui gate déjà GET /finance/summary", () => {
    const { tool } = buildTool();
    expect(tool.requiredPermissions).toEqual(["finance-summary.view"]);
  });

  it("délègue à FinanceSummaryService.getSummary() avec le vrai AuthenticatedUser, jamais une requête Prisma directe", async () => {
    const { tool, financeSummaryService } = buildTool();
    financeSummaryService.getSummary.mockResolvedValue({
      period: { year: 2026, month: 8 },
      totalRevenue: new Prisma.Decimal("1000000"),
      totalExpense: new Prisma.Decimal("400000"),
      cashBalance: new Prisma.Decimal("200000"),
      bankBalance: new Prisma.Decimal("300000"),
    });

    const envelope = await tool.execute({ month: 8, year: 2026 }, context);

    expect(financeSummaryService.getSummary).toHaveBeenCalledWith({ month: 8, year: 2026 }, user);
    expect(envelope.data).toEqual({
      period: { year: 2026, month: 8 },
      totalRevenue: "1000000",
      totalExpense: "400000",
      cashBalance: "200000",
      bankBalance: "300000",
    });
  });

  it("renvoie toujours une provenance non vide (jamais un chiffre sans source affichable)", async () => {
    const { tool, financeSummaryService } = buildTool();
    financeSummaryService.getSummary.mockResolvedValue({
      period: { year: 2026, month: 8 },
      totalRevenue: new Prisma.Decimal(0),
      totalExpense: new Prisma.Decimal(0),
      cashBalance: new Prisma.Decimal(0),
      bankBalance: new Prisma.Decimal(0),
    });

    const envelope = await tool.execute({}, context);

    expect(envelope.provenance.length).toBeGreaterThan(0);
    expect(envelope.provenance[0]?.module).toContain("Finance");
    expect(envelope.answer).toBeUndefined();
  });
});
