import { Prisma } from "@prisma/client";

import { HrPayrollMinimizer } from "../context/hr-payroll.minimizer";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { HrPayrollTool } from "./hr-payroll.tool";
import type { HrInsightsService } from "../../hr-insights/hr-insights.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

describe("HrPayrollTool", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const context: AiRequestContext = { user, permissions: new Set(["payslips.view"]), departmentIds: [] };

  function buildTool() {
    const service = { getPayrollSummary: jest.fn() };
    const tool = new HrPayrollTool(service as unknown as HrInsightsService, new HrPayrollMinimizer());
    return { tool, service };
  }

  it("déclare payslips.view -- distinct de employees.view -- comme permission requise (rejeu de l'exemple du brief)", () => {
    const { tool } = buildTool();
    expect(tool.requiredPermissions).toEqual(["payslips.view"]);
    expect(tool.requiredPermissions).not.toContain("employees.view");
  });

  it("délègue à HrInsightsService.getPayrollSummary et ne renvoie que des agrégats", async () => {
    const { tool, service } = buildTool();
    service.getPayrollSummary.mockResolvedValue({
      current: { year: 2026, month: 8, totalNetPay: new Prisma.Decimal("5000000"), payslipCount: 10 },
      previous: { year: 2026, month: 7, totalNetPay: new Prisma.Decimal("4800000"), payslipCount: 10 },
    });

    const envelope = await tool.execute({}, context);

    expect(service.getPayrollSummary).toHaveBeenCalledWith({}, user);
    expect(envelope.data.current.totalNetPay).toBe("5000000");
    expect(Object.keys(envelope.data.current)).toEqual(["year", "month", "totalNetPay", "payslipCount"]);
  });
});
