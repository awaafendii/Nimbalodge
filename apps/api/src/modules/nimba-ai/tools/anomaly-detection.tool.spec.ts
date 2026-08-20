import type { AnomalyDetectionService } from "../../anomaly-detection/anomaly-detection.service";
import type { Anomaly } from "../../anomaly-detection/anomaly";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { AnomalyDetectionTool } from "./anomaly-detection.tool";

describe("AnomalyDetectionTool", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const permissions = new Set(["finance-budgets.view"]);
  const context: AiRequestContext = { user, permissions, departmentIds: [] };

  function buildTool() {
    const anomalyDetectionService = { detectAnomalies: jest.fn() };
    const tool = new AnomalyDetectionTool(anomalyDetectionService as unknown as AnomalyDetectionService);
    return { tool, anomalyDetectionService };
  }

  it("n'a aucune permission requise au niveau du registre — le filtrage réel se fait par détecteur", () => {
    const { tool } = buildTool();
    expect(tool.requiredPermissions).toEqual([]);
  });

  it("délègue à AnomalyDetectionService avec le vrai AuthenticatedUser et le set de permissions déjà résolu", async () => {
    const { tool, anomalyDetectionService } = buildTool();
    const anomaly: Anomaly = {
      severity: "high",
      indicator: "Budget",
      period: { from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
      observedValue: "1500",
      referenceValue: "1000",
      explanation: "dépassement",
    };
    anomalyDetectionService.detectAnomalies.mockResolvedValue([anomaly]);

    const envelope = await tool.execute({ dateFrom: "2026-08-01", dateTo: "2026-09-01" }, context);

    expect(anomalyDetectionService.detectAnomalies).toHaveBeenCalledWith(
      user,
      permissions,
      new Date("2026-08-01"),
      new Date("2026-09-01")
    );
    expect(envelope.data.anomalies).toEqual([anomaly]);
    expect(envelope.provenance[0]?.module).toContain("Détection d'anomalies");
  });

  it("résout une période par défaut (mois courant) quand dateFrom/dateTo sont absents", async () => {
    const { tool, anomalyDetectionService } = buildTool();
    anomalyDetectionService.detectAnomalies.mockResolvedValue([]);

    const envelope = await tool.execute({}, context);

    expect(envelope.data.period.from).toBeDefined();
    expect(envelope.data.period.to).toBeDefined();
    expect(anomalyDetectionService.detectAnomalies).toHaveBeenCalledWith(user, permissions, expect.any(Date), expect.any(Date));
  });
});
