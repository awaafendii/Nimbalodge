import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";
import { FakeLLMProvider } from "../src/modules/nimba-ai/providers/fake-llm.provider";

// Étape 7 Nimba AI — vérifie la porte d'entrée (nimba-ai.use) ET l'application fine par Tool
// (permission réelle par capacité) via de vrais appels HTTP, pas seulement les mocks unitaires.
// Rejeu explicite de l'exemple du brief : un utilisateur avec employees.view mais sans
// payslips.view obtient l'effectif RH mais jamais la masse salariale.
// Regroupé en 4 logins au total (throttlé à 5/60s) : chaque tenant sert plusieurs assertions.
describe("Nimba AI — insights (RBAC réel)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejette toute requête d'insights sans authentification (401)", async () => {
    await request(app.getHttpServer()).get("/api/v1/nimba-ai/insights/finance").expect(401);
  });

  it("rejette un utilisateur sans nimba-ai.use, quelles que soient ses autres permissions (403)", async () => {
    // Login #1/4.
    const tenant = await createTenant(prisma, "nimba-ai-no-gate", ["finance-summary.view", "reports.financial.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);

    await authed(app, token).get("/api/v1/nimba-ai/insights/finance").expect(403);
  });

  it("autorise avec nimba-ai.use + la permission du Tool, refuse un autre Tool sans sa permission, et isole entre organisations", async () => {
    // Login #2/4.
    const tenantA = await createTenant(prisma, "nimba-ai-finance-ok", [
      "nimba-ai.use",
      "finance-summary.view",
      "finance-categories.create",
      "finance-cash-accounts.create",
      "finance-revenues.create",
    ]);
    const tokenA = await loginAndGetToken(app, tenantA.email, tenantA.password);
    const clientA = authed(app, tokenA);

    // Tool sans la permission de donnée réelle (reservations.view absente) -> refusé malgré
    // nimba-ai.use.
    await clientA.get("/api/v1/nimba-ai/insights/hospitality").expect(403);

    const category = await clientA.post("/api/v1/financial-categories").send({ name: "Hébergement", type: "REVENUE" }).expect(201);
    const cashAccount = await clientA.post("/api/v1/cash-accounts").send({ name: "Caisse principale", openingBalance: 0 }).expect(201);
    await clientA
      .post("/api/v1/revenues")
      .send({ amount: 750000, categoryId: category.body.id, cashAccountId: cashAccount.body.id, paymentMethod: "CASH", date: "2026-08-15" })
      .expect(201);

    const responseA = await clientA.get("/api/v1/nimba-ai/insights/finance?month=8&year=2026").expect(200);
    expect(responseA.body.data.totalRevenue).toBe("750000");
    expect(responseA.body.provenance.length).toBeGreaterThan(0);

    // Login #3/4 -- une autre organisation ne doit jamais voir la recette créée ci-dessus.
    const tenantB = await createTenant(prisma, "nimba-ai-isolation-b", ["nimba-ai.use", "finance-summary.view"]);
    const tokenB = await loginAndGetToken(app, tenantB.email, tenantB.password);

    const responseB = await authed(app, tokenB).get("/api/v1/nimba-ai/insights/finance?month=8&year=2026").expect(200);
    expect(responseB.body.data.totalRevenue).toBe("0");
  });

  it("rejeu exact de l'exemple du brief : employees.view sans payslips.view -> effectif OK, masse salariale refusée", async () => {
    // Login #4/4.
    const tenant = await createTenant(prisma, "nimba-ai-restaurant-manager", ["nimba-ai.use", "employees.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);
    const client = authed(app, token);

    await client.get("/api/v1/nimba-ai/insights/hr-workforce").expect(200);
    await client.get("/api/v1/nimba-ai/insights/hr-payroll").expect(403);
  });
});

// Étape 8 Nimba AI — l'endpoint /nimba-ai/anomalies n'exige QUE nimba-ai.use au niveau du Tool
// (requiredPermissions volontairement vide, voir anomaly-detection.tool.ts) ; le filtrage réel se
// fait par détecteur dans AnomalyDetectionService, ici vérifié via un vrai StockAnomalyDetector
// (produit sous seuil, aucun mouvement de stock nécessaire — le solde par défaut est 0) plutôt
// qu'un mock. Regroupé en 2 logins (throttlé à 5/60s).
describe("Nimba AI — détection d'anomalies (RBAC réel)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("un demandeur avec nimba-ai.use mais aucune permission couverte par un détecteur reçoit un tableau vide, jamais une erreur", async () => {
    // Login #1/2.
    const tenant = await createTenant(prisma, "nimba-ai-anomaly-no-coverage", ["nimba-ai.use"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);

    const response = await authed(app, token).get("/api/v1/nimba-ai/anomalies").expect(200);
    expect(response.body.data.anomalies).toEqual([]);
  });

  it("products.view fait tourner StockAnomalyDetector et remonte un produit réellement sous son seuil", async () => {
    // Login #2/2.
    const tenant = await createTenant(prisma, "nimba-ai-anomaly-stock", ["nimba-ai.use", "products.view", "products.create"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);
    const client = authed(app, token);

    const product = await client.post("/api/v1/products").send({ name: "Savon", minThreshold: 10 }).expect(201);

    const response = await client.get("/api/v1/nimba-ai/anomalies").expect(200);
    const stockAnomaly = response.body.data.anomalies.find((anomaly: { resourceType?: string }) => anomaly.resourceType === "product");

    expect(stockAnomaly).toMatchObject({ resourceId: product.body.id, observedValue: "0", referenceValue: "10" });
  });
});

// Étape 9 Nimba AI — LLM_PROVIDER_TOKEN est substitué par FakeLLMProvider dans createTestApp()
// (voir test-app.ts : @prisma/client charge le vrai `.env` du poste comme effet de bord de sa
// propre résolution d'env(), donc GEMINI_API_KEY ne peut pas être fiablement neutralisée par
// simple manipulation de process.env — jamais un appel réseau réel à Gemini dans ce dépôt de
// tests). RBAC/scope/orchestration/audit restent 100% réels ; seul l'appel sortant vers le
// fournisseur LLM est remplacé par ce double programmable. La matrice "IA non configurée"
// (isConfigured() === false) est couverte en unit (gemini.provider.spec.ts +
// ai-chat.service.spec.ts) — pas re-testée ici. Regroupé en 2 logins (throttlé à 5/60s).
describe("Nimba AI — assistant conversationnel (RBAC réel, LLM programmable)", () => {
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

  it("rejette toute requête de chat sans authentification (401)", async () => {
    await request(app.getHttpServer()).post("/api/v1/nimba-ai/chat").send({ message: "Bonjour" }).expect(401);
  });

  it("rejette un utilisateur sans nimba-ai.use (403)", async () => {
    // Login #1/2.
    const tenant = await createTenant(prisma, "nimba-ai-chat-no-gate", ["finance-summary.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);

    await authed(app, token).post("/api/v1/nimba-ai/chat").send({ message: "Bonjour" }).expect(403);
  });

  it("avec nimba-ai.use : un aller-retour complet RBAC + Tool réel, le LLM ne fait que reformuler le résultat déjà calculé", async () => {
    // Login #2/2.
    const tenant = await createTenant(prisma, "nimba-ai-chat-flow", ["nimba-ai.use", "finance-summary.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);

    fakeLlmProvider.enqueue({ toolCalls: [{ name: "finance-summary", arguments: {} }] });
    fakeLlmProvider.enqueue({ text: "Les recettes de ce mois sont de 0 GNF." });

    const response = await authed(app, token)
      .post("/api/v1/nimba-ai/chat")
      .send({ message: "Quel est le chiffre d'affaires de ce mois ?" })
      .expect(201);

    expect(response.body.answer).toBe("Les recettes de ce mois sont de 0 GNF.");
    expect(response.body.toolResults).toEqual([{ tool: "finance-summary", data: expect.objectContaining({ totalRevenue: "0" }) }]);
    expect(response.body.provenance.length).toBeGreaterThan(0);
  });
});
