import type { PrismaService } from "../../database/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { AuditLogsService } from "./audit-logs.service";

// Unit — Prisma entièrement mocké. Couvre countFailuresByActor() (Nimba AI Étape 8,
// AuditTrailAnomalyDetector) : deux groupBy distincts (userId / ipAddress), jamais fusionnés --
// une rafale d'échecs de connexion anonymes (userId nul) doit rester visible par IP.
describe("AuditLogsService.countFailuresByActor", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };

  function buildService() {
    const prisma = { auditLog: { groupBy: jest.fn() } };
    const service = new AuditLogsService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  it("regroupe les échecs par utilisateur et par IP séparément", async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.groupBy
      .mockResolvedValueOnce([{ userId: "user-2", _count: { _all: 6 } }])
      .mockResolvedValueOnce([{ ipAddress: "10.0.0.5", _count: { _all: 9 } }]);

    const result = await service.countFailuresByActor(new Date("2026-08-01"), new Date("2026-08-02"), user);

    expect(result.byUser).toEqual([{ userId: "user-2", count: 6 }]);
    expect(result.byIp).toEqual([{ ipAddress: "10.0.0.5", count: 9 }]);
  });

  it("filtre toujours sur outcome=FAILURE et le scope organisation/hôtel du demandeur", async () => {
    const { service, prisma } = buildService();
    prisma.auditLog.groupBy.mockResolvedValue([]);

    await service.countFailuresByActor(new Date("2026-08-01"), new Date("2026-08-02"), user);

    const firstCall = prisma.auditLog.groupBy.mock.calls[0][0];
    expect(firstCall.where).toEqual(
      expect.objectContaining({ organizationId: "org-1", hotelId: "hotel-1", outcome: "FAILURE" })
    );
  });
});
