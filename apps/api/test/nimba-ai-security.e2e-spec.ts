import { INestApplication } from "@nestjs/common";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";
import { FakeLLMProvider } from "../src/modules/nimba-ai/providers/fake-llm.provider";
import { AiToolRegistry } from "../src/modules/nimba-ai/tools/ai-tool-registry";
import type { AiRequestContext } from "../src/modules/nimba-ai/orchestrator/ai-orchestrator.service";
import { BASE_PERMISSIONS } from "../../../prisma/permissions-catalog";

// Étape 11 Nimba AI — passe dédiée sécurité/permissions/hallucinations (liste du plan
// d'architecture Nimba AI), en plus des tests unitaires/e2e déjà écrits au fil des étapes
// précédentes (RBAC réel par Tool, isolation d'organisation, rejeu du brief sur les endpoints
// Insights, minimisation stricte des données RH/paie...). Regroupé en 3 logins (throttlé à 5/60s) ;
// le test du registre de Tools n'a besoin d'aucun login (résolution DI directe).
describe("Nimba AI — tests sécurité dédiés (Étape 11)", () => {
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

  it("le registre de Tools n'expose que des capacités de lecture -- surface exacte, aucun Tool en écriture (aucun login requis)", () => {
    const toolRegistry = app.get(AiToolRegistry);
    const allPermissionsContext: AiRequestContext = {
      user: { id: "probe", organizationId: "probe", hotelId: null },
      permissions: new Set(BASE_PERMISSIONS.map((permission) => permission.key)),
      departmentIds: [],
    };

    const names = toolRegistry.listAvailable(allPermissionsContext).map((tool) => tool.name).sort();

    // Liste figée volontairement : tout nouveau Tool doit être ajouté ici explicitement (jamais
    // "juste passer" implicitement), et rester un verbe de LECTURE (résumé/comparaison/scan),
    // jamais create/update/delete -- chacun des 6 Tools ci-dessous délègue exclusivement à des
    // méthodes de lecture des services métier (getX()/list()/detectAnomalies()), vérifié par
    // relecture de chaque tools/*.tool.ts.
    expect(names).toEqual(
      ["anomaly-scan", "department-comparison", "finance-summary", "hr-payroll-summary", "hr-workforce-summary", "occupancy-summary"].sort()
    );
  });

  it("rejeu du brief via le chat : un Tool RH non autorisé reste refusé même si le LLM tente de l'appeler", async () => {
    // Login #1/3.
    const tenant = await createTenant(prisma, "nimba-ai-sec-brief", ["nimba-ai.use", "employees.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);

    fakeLlmProvider.enqueue({ toolCalls: [{ name: "hr-payroll-summary", arguments: {} }] });
    fakeLlmProvider.enqueue({ text: "Je n'ai pas accès à la masse salariale pour répondre à cette question." });

    const response = await authed(app, token)
      .post("/api/v1/nimba-ai/chat")
      .send({ message: "Quel est le salaire total de tous les employés de l'hôtel ?" })
      .expect(201);

    expect(response.body.answer).toContain("pas accès");
    // Aucune donnée de paie n'a jamais atteint la réponse -- ni dans toolResults, ni dans provenance.
    expect(response.body.toolResults).toEqual([]);
    expect(response.body.provenance).toEqual([]);
  });

  it("les chiffres renvoyés par Nimba AI correspondent exactement à l'endpoint métier équivalent (jamais recalculés par le LLM)", async () => {
    // Login #2/3.
    const tenant = await createTenant(prisma, "nimba-ai-sec-numbers", [
      "nimba-ai.use",
      "finance-summary.view",
      "finance-categories.create",
      "finance-cash-accounts.create",
      "finance-revenues.create",
    ]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);
    const client = authed(app, token);

    const category = await client.post("/api/v1/financial-categories").send({ name: "Hébergement", type: "REVENUE" }).expect(201);
    const cashAccount = await client.post("/api/v1/cash-accounts").send({ name: "Caisse principale", openingBalance: 0 }).expect(201);
    await client
      .post("/api/v1/revenues")
      .send({ amount: 913000, categoryId: category.body.id, cashAccountId: cashAccount.body.id, paymentMethod: "CASH", date: "2026-08-15" })
      .expect(201);

    const direct = await client.get("/api/v1/finance/summary?month=8&year=2026").expect(200);
    const viaAi = await client.get("/api/v1/nimba-ai/insights/finance?month=8&year=2026").expect(200);

    expect(viaAi.body.data.totalRevenue).toBe(direct.body.totalRevenue.toString());
    expect(viaAi.body.data.totalRevenue).toBe("913000");
  });

  it("une erreur du fournisseur LLM ne casse jamais les Insights déterministes (chemins de code indépendants)", async () => {
    // Login #3/3.
    const tenant = await createTenant(prisma, "nimba-ai-sec-llm-failure", ["nimba-ai.use", "finance-summary.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);
    const client = authed(app, token);

    fakeLlmProvider.enqueueError(new Error("panne simulée du fournisseur LLM"));
    const chatResponse = await client.post("/api/v1/nimba-ai/chat").send({ message: "Bonjour" }).expect(201);
    expect(chatResponse.body.answer).toBeUndefined();
    expect(chatResponse.body.disclaimer).toContain("indisponible");

    const insightsResponse = await client.get("/api/v1/nimba-ai/insights/finance").expect(200);
    expect(insightsResponse.body.data).toBeDefined();
    expect(insightsResponse.body.data.totalRevenue).toBe("0");
  });
});
