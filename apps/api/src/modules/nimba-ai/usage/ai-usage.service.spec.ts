import type { PrismaService } from "../../../database/prisma.service";
import { AiUsageService } from "./ai-usage.service";

// Unit — Prisma entièrement mocké. Couvre : écriture correcte des champs, et surtout le
// comportement best-effort (une erreur d'écriture ne doit jamais se propager à l'appelant, exactement
// comme AuditService.record()).
describe("AiUsageService", () => {
  function buildService() {
    const prisma = { aiUsageLog: { create: jest.fn() } };
    const service = new AiUsageService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  it("écrit une ligne AiUsageLog avec tous les champs fournis", async () => {
    const { service, prisma } = buildService();
    prisma.aiUsageLog.create.mockResolvedValue({});

    await service.record({
      organizationId: "org-1",
      hotelId: "hotel-1",
      userId: "user-1",
      provider: "gemini",
      model: "gemini-1.5-flash",
      requestType: "chat",
      inputTokens: 120,
      outputTokens: 45,
      latencyMs: 850,
      status: "SUCCESS",
    });

    expect(prisma.aiUsageLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        hotelId: "hotel-1",
        userId: "user-1",
        provider: "gemini",
        model: "gemini-1.5-flash",
        requestType: "chat",
        inputTokens: 120,
        outputTokens: 45,
        latencyMs: 850,
        status: "SUCCESS",
      },
    });
  });

  it("accepte hotelId null (demandeur org-wide) et l'absence de compteurs de tokens", async () => {
    const { service, prisma } = buildService();
    prisma.aiUsageLog.create.mockResolvedValue({});

    await service.record({
      organizationId: "org-1",
      hotelId: null,
      userId: "user-1",
      provider: "gemini",
      model: "gemini-1.5-flash",
      requestType: "anomaly",
      latencyMs: 12,
      status: "DENIED",
    });

    const call = prisma.aiUsageLog.create.mock.calls[0][0];
    expect(call.data.hotelId).toBeNull();
    expect(call.data.inputTokens).toBeUndefined();
    expect(call.data.status).toBe("DENIED");
  });

  it("ne propage jamais une erreur d'écriture (best-effort, comme AuditService)", async () => {
    const { service, prisma } = buildService();
    prisma.aiUsageLog.create.mockRejectedValue(new Error("DB indisponible"));

    await expect(
      service.record({
        organizationId: "org-1",
        hotelId: null,
        userId: "user-1",
        provider: "gemini",
        model: "gemini-1.5-flash",
        requestType: "insight",
        latencyMs: 5,
        status: "FAILURE",
      })
    ).resolves.toBeUndefined();
  });
});
