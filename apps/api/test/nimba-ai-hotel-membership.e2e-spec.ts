import { INestApplication } from "@nestjs/common";

import { resetDatabase } from "./support/database";
import {
  addHotelMembership,
  createHotelMembershipUser,
  createHotelUser,
  createOrganizationWithRole,
  createRole,
  createTenant,
  createUserInHotel,
  seedPermissionCatalog,
} from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";
import { FakeLLMProvider } from "../src/modules/nimba-ai/providers/fake-llm.provider";

async function waitForAuditLog(prisma: PrismaService, where: Record<string, unknown>, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: "desc" } });
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`AuditLog introuvable pour ${JSON.stringify(where)} après ${timeoutMs}ms`);
}

async function seedRevenue(client: ReturnType<typeof authed>, amount: number) {
  const category = await client.post("/api/v1/financial-categories").send({ name: "Hébergement", type: "REVENUE" }).expect(201);
  const cashAccount = await client.post("/api/v1/cash-accounts").send({ name: "Caisse", openingBalance: 0 }).expect(201);
  await client
    .post("/api/v1/revenues")
    .send({ amount, categoryId: category.body.id, cashAccountId: cashAccount.body.id, paymentMethod: "CASH", date: "2026-08-15" })
    .expect(201);
}

// RBAC multi-hôtel × Nimba AI : vérifie que le pipeline IA (AiOrchestratorService.resolveContext →
// AiToolRegistry → Tool → service métier) respecte exactement le même scope hôtel/organisation/
// département/permission que le reste de l'API REST, sans logique de sécurité parallèle. Complète
// nimba-ai-security.e2e-spec.ts (Étape 11, focalisé sur RBAC générique/hallucinations) avec le volet
// spécifique HotelMembership/switch-hotel introduit ensuite.
describe("Nimba AI × RBAC multi-hôtel (HotelMembership)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeLlmProvider: FakeLLMProvider;

  beforeAll(async () => {
    ({ app, prisma, fakeLlmProvider } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("un utilisateur avec HotelMembership sur un seul hôtel n'obtient que les données Nimba AI de cet hôtel, y compris après une tentative de switch refusée", async () => {
    // Login #1/5.
    const org = await createOrganizationWithRole(prisma, "ai-hm-single", [
      "nimba-ai.use",
      "finance-summary.view",
      "finance-categories.create",
      "finance-cash-accounts.create",
      "finance-revenues.create",
    ]);
    const hotelA = await createHotelUser(prisma, org.organizationId, org.roleId, "ai-hm-single-a");
    const hotelB = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "AI HM Single B", slug: "ai-hm-single-b" },
    });
    const member = await createHotelMembershipUser(prisma, org.organizationId, hotelA.hotelId, org.roleId, "ai-single");
    const token = await loginAndGetToken(app, member.email, member.password);
    const client = authed(app, token);

    await seedRevenue(client, 777000);

    const insightsBefore = await client.get("/api/v1/nimba-ai/insights/finance?month=8&year=2026").expect(200);
    expect(insightsBefore.body.data.totalRevenue).toBe("777000");

    const switchResponse = await client.post("/api/v1/auth/switch-hotel").send({ hotelId: hotelB.id });
    expect(switchResponse.status).toBe(403);
    await waitForAuditLog(prisma, { userId: member.userId, action: "switch-hotel", outcome: "FAILURE", hotelId: hotelB.id });

    // Le token n'a pas changé (switch refusé) : le contexte Nimba AI reste celui de l'hôtel A, jamais B.
    const insightsAfter = await client.get("/api/v1/nimba-ai/insights/finance?month=8&year=2026").expect(200);
    expect(insightsAfter.body.data.totalRevenue).toBe("777000");
  });

  it("un utilisateur multi-hôtel voit ses réponses Nimba AI changer après switch-hotel — jamais de fuite de l'ancien hôtel, même quand la question nomme explicitement l'autre hôtel", async () => {
    // Login #2/5.
    const org = await createOrganizationWithRole(prisma, "ai-hm-multi", []);
    const hotelA = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "AI HM Multi A", slug: "ai-hm-multi-a" },
    });
    const hotelB = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "AI HM Multi B", slug: "ai-hm-multi-b" },
    });
    const role = await createRole(prisma, org.organizationId, "TEST_AI_MULTI", [
      "nimba-ai.use",
      "finance-summary.view",
      "finance-categories.create",
      "finance-cash-accounts.create",
      "finance-revenues.create",
    ]);
    const member = await createHotelMembershipUser(prisma, org.organizationId, hotelA.id, role, "ai-multi");
    await addHotelMembership(prisma, member.userId, hotelB.id, role);

    let token = await loginAndGetToken(app, member.email, member.password);
    let client = authed(app, token);

    await seedRevenue(client, 111000); // Hôtel A actif
    const insightsA = await client.get("/api/v1/nimba-ai/insights/finance?month=8&year=2026").expect(200);
    expect(insightsA.body.data.totalRevenue).toBe("111000");

    const switchResponse = await client.post("/api/v1/auth/switch-hotel").send({ hotelId: hotelB.id }).expect(200);
    token = switchResponse.body.accessToken;
    client = authed(app, token);

    await seedRevenue(client, 222000); // Hôtel B actif — montant volontairement différent
    const insightsB = await client.get("/api/v1/nimba-ai/insights/finance?month=8&year=2026").expect(200);
    expect(insightsB.body.data.totalRevenue).toBe("222000");

    // Question en langage naturel qui NOMME explicitement l'autre hôtel (A) alors que le contexte
    // actif est B : aucun Tool Nimba AI n'expose de paramètre hotelId (voir finance-insights.tool.ts)
    // — la réponse ne peut donc structurellement renvoyer que les données de l'hôtel actif (B),
    // jamais celles de l'hôtel nommé dans la question.
    fakeLlmProvider.enqueue({ toolCalls: [{ name: "finance-summary", arguments: { month: 8, year: 2026 } }] });
    fakeLlmProvider.enqueue({ text: "Voici le résumé financier de votre hôtel actif." });
    const chatResponse = await client
      .post("/api/v1/nimba-ai/chat")
      .send({ message: "Quelle est la recette du mois pour l'Hôtel AI HM Multi A ?" })
      .expect(201);

    expect(chatResponse.body.toolResults).toHaveLength(1);
    expect(chatResponse.body.toolResults[0].data.totalRevenue).toBe("222000");
    expect(JSON.stringify(chatResponse.body)).not.toContain("111000");

    // Le même utilisateur, avec le même rôle sur les deux hôtels, n'a reçu ni nimba-ai.use pour la
    // RH ni payslips.view : un Tool RH refusé même si le LLM tente de l'appeler, sans fuite ni
        // hallucination — rejeu du brief (voir nimba-ai-security.e2e-spec.ts) mais avec un utilisateur
    // scopé via HotelMembership plutôt que UserRole.
    fakeLlmProvider.enqueue({ toolCalls: [{ name: "hr-payroll-summary", arguments: {} }] });
    fakeLlmProvider.enqueue({ text: "Je n'ai pas accès à la masse salariale pour répondre à cette question." });
    const hrResponse = await client
      .post("/api/v1/nimba-ai/chat")
      .send({ message: "Quelle est la masse salariale de cet hôtel ?" })
      .expect(201);
    expect(hrResponse.body.answer).toContain("pas accès");
    expect(hrResponse.body.toolResults).toEqual([]);
    expect(hrResponse.body.provenance).toEqual([]);

    const deniedLog = await waitForAuditLog(prisma, {
      userId: member.userId,
      action: "tool-denied",
      outcome: "FAILURE",
      hotelId: hotelB.id,
    });
    expect(deniedLog.path).toBe("/nimba-ai/tools/hr-payroll-summary");
    expect(deniedLog.errorMessage).toContain("Permissions insuffisantes");
  });

  it("la permission métier seule (sans nimba-ai.use) ne donne accès à aucun endpoint Nimba AI, y compris le chat", async () => {
    // Login #3/5.
    const tenant = await createTenant(prisma, "ai-hm-no-use", ["finance-summary.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);
    const client = authed(app, token);

    await client.get("/api/v1/nimba-ai/insights/finance").expect(403);
    await client.post("/api/v1/nimba-ai/chat").send({ message: "Bonjour" }).expect(403);
    await client.get("/api/v1/nimba-ai/anomalies").expect(403);
  });

  it("department-comparison (Nimba AI) applique le même scope que ReportsService.financialReport côté REST — comportement vérifié, pas supposé", async () => {
    // Login #4/5 (admin) + #5/5 (responsable département).
    const tenant = await createTenant(prisma, "ai-hm-dept", [
      "nimba-ai.use",
      "reports.financial.view",
      "departments.create",
      "departments.view",
      "departments.update",
      "finance-categories.create",
      "finance-expenses.create",
    ]);
    const adminToken = await loginAndGetToken(app, tenant.email, tenant.password);
    const adminClient = authed(app, adminToken);

    const restaurantManager = await createUserInHotel(
      prisma,
      tenant.organizationId,
      tenant.roleId,
      tenant.hotelId,
      "ai-hm-dept-restaurant-manager"
    );
    const managerToken = await loginAndGetToken(app, restaurantManager.email, restaurantManager.password);
    const managerClient = authed(app, managerToken);

    const restaurantDept = await adminClient.post("/api/v1/departments").send({ name: "Restaurant" }).expect(201);
    const housekeepingDept = await adminClient.post("/api/v1/departments").send({ name: "Housekeeping" }).expect(201);

    const managerId = (await prisma.user.findUniqueOrThrow({ where: { email: restaurantManager.email } })).id;
    await adminClient.post(`/api/v1/departments/${restaurantDept.body.id}/users/${managerId}`).expect(201);

    const category = await adminClient.post("/api/v1/financial-categories").send({ name: "Achats généraux", type: "EXPENSE" }).expect(201);
    await adminClient
      .post("/api/v1/expenses")
      .send({ categoryId: category.body.id, amount: 50000, paymentMethod: "CASH", departmentId: restaurantDept.body.id })
      .expect(201);
    await adminClient
      .post("/api/v1/expenses")
      .send({ categoryId: category.body.id, amount: 30000, paymentMethod: "CASH", departmentId: housekeepingDept.body.id })
      .expect(201);

    const viaRest = await managerClient
      .get(`/api/v1/reports/financial?groupBy=department&dateFrom=2026-08-01&dateTo=2026-09-01`)
      .expect(200);
    const viaAi = await managerClient.get(`/api/v1/nimba-ai/insights/department?dateFrom=2026-08-01&dateTo=2026-09-01`).expect(200);

    const restIds = (viaRest.body.rows as { key: string }[]).map((row) => row.key).sort();
    const aiIds = (viaAi.body.data.rows as { departmentId: string }[]).map((row) => row.departmentId).sort();

    // Assertion volontairement relative (AI == REST), pas une valeur figée à l'avance : le Tool ne
    // doit ni élargir ni restreindre par rapport à l'endpoint REST équivalent, quel que soit le
    // comportement réel de ReportsService.financialReport vis-à-vis du scope départemental.
    expect(aiIds).toEqual(restIds);
  });
});
