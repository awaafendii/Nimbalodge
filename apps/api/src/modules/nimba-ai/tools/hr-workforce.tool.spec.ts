import { HrWorkforceMinimizer } from "../context/hr-workforce.minimizer";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { HrWorkforceTool } from "./hr-workforce.tool";
import type { HrInsightsService } from "../../hr-insights/hr-insights.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

describe("HrWorkforceTool", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const context: AiRequestContext = { user, permissions: new Set(["employees.view"]), departmentIds: [] };

  function buildTool() {
    const service = { getWorkforceSummary: jest.fn() };
    const tool = new HrWorkforceTool(service as unknown as HrInsightsService, new HrWorkforceMinimizer());
    return { tool, service };
  }

  it("déclare employees.view (jamais payslips.view) comme permission requise", () => {
    const { tool } = buildTool();
    expect(tool.requiredPermissions).toEqual(["employees.view"]);
  });

  it("délègue à HrInsightsService.getWorkforceSummary avec le vrai AuthenticatedUser", async () => {
    const { tool, service } = buildTool();
    service.getWorkforceSummary.mockResolvedValue({
      period: { dateFrom: new Date("2026-08-01"), dateTo: new Date("2026-09-01") },
      headcount: 8,
      scheduledShifts: 20,
      attendedShifts: 18,
      absenteeismRate: 0.1,
      leaveRequestsByStatus: {},
    });

    const envelope = await tool.execute({}, context);

    expect(service.getWorkforceSummary).toHaveBeenCalledWith({}, user);
    expect(envelope.data.headcount).toBe(8);
    expect(envelope.data.absenteeismRatePercent).toBe(10);
  });
});
