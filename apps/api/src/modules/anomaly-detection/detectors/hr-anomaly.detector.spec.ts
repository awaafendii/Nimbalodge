import type { HrInsightsService } from "../../hr-insights/hr-insights.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { HrAnomalyDetector } from "./hr-anomaly.detector";

describe("HrAnomalyDetector", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = new Date("2026-08-01T00:00:00Z");
  const dateTo = new Date("2026-09-01T00:00:00Z");

  function buildDetector() {
    const hrInsightsService = { getWorkforceSummary: jest.fn() };
    const detector = new HrAnomalyDetector(hrInsightsService as unknown as HrInsightsService);
    return { detector, hrInsightsService };
  }

  it("signale une hausse d'absentéisme >= 20% par rapport à la période précédente", async () => {
    const { detector, hrInsightsService } = buildDetector();
    hrInsightsService.getWorkforceSummary
      .mockResolvedValueOnce({ absenteeismRate: 0.3 })
      .mockResolvedValueOnce({ absenteeismRate: 0.1 });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ indicator: "Absentéisme", observedValue: "30%", referenceValue: "10%" });
  });

  it("ne renvoie rien si l'une des deux périodes n'a pas de taux mesurable (null)", async () => {
    const { detector, hrInsightsService } = buildDetector();
    hrInsightsService.getWorkforceSummary
      .mockResolvedValueOnce({ absenteeismRate: 0.3 })
      .mockResolvedValueOnce({ absenteeismRate: null });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
  });

  it("ignore un écart sous le seuil de 20%", async () => {
    const { detector, hrInsightsService } = buildDetector();
    hrInsightsService.getWorkforceSummary
      .mockResolvedValueOnce({ absenteeismRate: 0.11 })
      .mockResolvedValueOnce({ absenteeismRate: 0.1 });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
  });
});
