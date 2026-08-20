import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { AnomalyDetectionService } from "./anomaly-detection.service";
import type { Anomaly } from "./anomaly";
import type { AnomalyDetector } from "./detectors/anomaly-detector.interface";

// Unit — couvre le filtrage par permission (un détecteur ne tourne QUE si sa permission est dans
// le set du demandeur) et la résilience (l'échec d'un détecteur n'empêche jamais les autres de
// répondre). AiToolRegistry/RBAC "porte d'entrée" ne sont pas concernés ici (couverts ailleurs) —
// ce test couvre uniquement le dispatch fin par permission propre à AnomalyDetectionService.
describe("AnomalyDetectionService", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = new Date("2026-08-01T00:00:00Z");
  const dateTo = new Date("2026-09-01T00:00:00Z");

  function fakeAnomaly(source: string): Anomaly {
    return {
      severity: "low",
      indicator: source,
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      observedValue: "1",
      referenceValue: "1",
      explanation: source,
    };
  }

  it("ne fait tourner que les détecteurs dont la permission requise est accordée", async () => {
    const allowedDetector: AnomalyDetector = {
      source: "allowed",
      requiredPermission: "finance-budgets.view",
      detect: jest.fn().mockResolvedValue([fakeAnomaly("allowed")]),
    };
    const deniedDetector: AnomalyDetector = {
      source: "denied",
      requiredPermission: "payslips.view",
      detect: jest.fn().mockResolvedValue([fakeAnomaly("denied")]),
    };
    const service = new AnomalyDetectionService([allowedDetector, deniedDetector]);

    const result = await service.detectAnomalies(user, new Set(["finance-budgets.view"]), dateFrom, dateTo);

    expect(result).toEqual([fakeAnomaly("allowed")]);
    expect(deniedDetector.detect).not.toHaveBeenCalled();
  });

  it("l'échec d'un détecteur n'empêche jamais les autres de répondre", async () => {
    const failingDetector: AnomalyDetector = {
      source: "failing",
      requiredPermission: "products.view",
      detect: jest.fn().mockRejectedValue(new Error("boom")),
    };
    const okDetector: AnomalyDetector = {
      source: "ok",
      requiredPermission: "products.view",
      detect: jest.fn().mockResolvedValue([fakeAnomaly("ok")]),
    };
    const service = new AnomalyDetectionService([failingDetector, okDetector]);

    const result = await service.detectAnomalies(user, new Set(["products.view"]), dateFrom, dateTo);

    expect(result).toEqual([fakeAnomaly("ok")]);
  });

  it("renvoie un tableau vide si le demandeur n'a aucune des permissions couvertes", async () => {
    const detector: AnomalyDetector = {
      source: "hr",
      requiredPermission: "employees.view",
      detect: jest.fn(),
    };
    const service = new AnomalyDetectionService([detector]);

    const result = await service.detectAnomalies(user, new Set(["reservations.view"]), dateFrom, dateTo);

    expect(result).toEqual([]);
    expect(detector.detect).not.toHaveBeenCalled();
  });
});
