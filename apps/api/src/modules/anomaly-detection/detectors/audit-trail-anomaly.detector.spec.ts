import type { AuditLogsService } from "../../audit-logs/audit-logs.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { AuditTrailAnomalyDetector } from "./audit-trail-anomaly.detector";

describe("AuditTrailAnomalyDetector", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = new Date("2026-08-01T00:00:00Z");
  const dateTo = new Date("2026-09-01T00:00:00Z");

  function buildDetector() {
    const auditLogsService = { countFailuresByActor: jest.fn() };
    const detector = new AuditTrailAnomalyDetector(auditLogsService as unknown as AuditLogsService);
    return { detector, auditLogsService };
  }

  it("signale un utilisateur et une IP au-dessus de leur seuil respectif", async () => {
    const { detector, auditLogsService } = buildDetector();
    auditLogsService.countFailuresByActor.mockResolvedValue({
      byUser: [{ userId: "user-2", count: 8 }],
      byIp: [{ ipAddress: "10.0.0.5", count: 15 }],
    });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toHaveLength(2);
    expect(result.find((a) => a.resourceType === "user")).toMatchObject({ resourceId: "user-2" });
    expect(result.find((a) => a.resourceType === "ip-address")).toMatchObject({ resourceId: "10.0.0.5" });
  });

  it("ignore les compteurs sous le seuil", async () => {
    const { detector, auditLogsService } = buildDetector();
    auditLogsService.countFailuresByActor.mockResolvedValue({
      byUser: [{ userId: "user-2", count: 2 }],
      byIp: [{ ipAddress: "10.0.0.5", count: 3 }],
    });

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
  });
});
