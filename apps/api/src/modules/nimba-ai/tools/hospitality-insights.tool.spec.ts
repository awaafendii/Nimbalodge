import { Prisma } from "@prisma/client";

import { HospitalityInsightsMinimizer } from "../context/hospitality-insights.minimizer";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { HospitalityInsightsTool } from "./hospitality-insights.tool";
import type { HospitalityInsightsService } from "../../hospitality-insights/hospitality-insights.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

describe("HospitalityInsightsTool", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const context: AiRequestContext = { user, permissions: new Set(["reservations.view"]), departmentIds: [] };

  function buildTool() {
    const service = { getOccupancySummary: jest.fn() };
    const tool = new HospitalityInsightsTool(service as unknown as HospitalityInsightsService, new HospitalityInsightsMinimizer());
    return { tool, service };
  }

  it("déclare reservations.view comme permission requise", () => {
    const { tool } = buildTool();
    expect(tool.requiredPermissions).toEqual(["reservations.view"]);
  });

  it("délègue à HospitalityInsightsService avec le vrai AuthenticatedUser", async () => {
    const { tool, service } = buildTool();
    const period = { availableRooms: 1, availableRoomNights: 10, occupiedRoomNights: 5, occupancyRate: 0.5, totalRoomRevenue: new Prisma.Decimal(0), adr: null, revpar: null };
    service.getOccupancySummary.mockResolvedValue({
      period: { dateFrom: new Date("2026-08-01"), dateTo: new Date("2026-08-11") },
      current: period,
      previous: period,
      reservationsByStatus: {},
    });

    const envelope = await tool.execute({ dateFrom: "2026-08-01", dateTo: "2026-08-11" }, context);

    expect(service.getOccupancySummary).toHaveBeenCalledWith({ dateFrom: "2026-08-01", dateTo: "2026-08-11" }, user);
    expect(envelope.provenance[0]?.module).toContain("Hôtellerie");
    expect(envelope.data.current.occupancyRatePercent).toBe(50);
  });
});
