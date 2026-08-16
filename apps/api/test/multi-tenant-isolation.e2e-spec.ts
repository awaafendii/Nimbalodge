import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createHotelUser, createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Vérifie que assertInScope() (Étape 1 — extrait de ~33 services dupliqués vers
// apps/api/src/common/utils/assert-in-scope.ts) protège toujours correctement l'isolation
// multi-tenant après le refactor, sur deux modules distincts pour couvrir des call sites
// différents (Department : findOne direct ; FinancialCategory : même pattern, module séparé).
describe("Isolation multi-tenant (assertInScope)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let hotelA1Token: string;
  let hotelA2Token: string;
  let orgBToken: string;
  let departmentId: string;
  let categoryId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const orgA = await createTenant(prisma, "isolation-org-a");
    const hotelA2 = await createHotelUser(prisma, orgA.organizationId, orgA.roleId, "isolation-org-a-hotel-2");
    const orgB = await createTenant(prisma, "isolation-org-b");

    hotelA1Token = await loginAndGetToken(app, orgA.email, orgA.password);
    hotelA2Token = await loginAndGetToken(app, hotelA2.email, hotelA2.password);
    orgBToken = await loginAndGetToken(app, orgB.email, orgB.password);

    const departmentResponse = await authed(app, hotelA1Token)
      .post("/api/v1/departments")
      .send({ name: "Réception" })
      .expect(201);
    departmentId = departmentResponse.body.id;

    const categoryResponse = await authed(app, hotelA1Token)
      .post("/api/v1/financial-categories")
      .send({ name: "Hébergement", type: "REVENUE" })
      .expect(201);
    categoryId = categoryResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("autorise l'accès dans le périmètre (même hôtel)", async () => {
    await authed(app, hotelA1Token).get(`/api/v1/departments/${departmentId}`).expect(200);
    await authed(app, hotelA1Token).get(`/api/v1/financial-categories/${categoryId}`).expect(200);
  });

  it("refuse 403 pour un autre hôtel de la même organisation", async () => {
    const response = await authed(app, hotelA2Token).get(`/api/v1/departments/${departmentId}`).expect(403);
    expect(response.body.message).toContain("hôtel");
  });

  it("refuse 403 pour une organisation différente", async () => {
    const response = await authed(app, orgBToken).get(`/api/v1/departments/${departmentId}`).expect(403);
    expect(response.body.message).toContain("organisation");
  });

  it("refuse 403 pour une organisation différente (2e module — financial-categories)", async () => {
    await authed(app, orgBToken).get(`/api/v1/financial-categories/${categoryId}`).expect(403);
  });

  it("refuse 401 sans token", async () => {
    await request(app.getHttpServer()).get(`/api/v1/departments/${departmentId}`).expect(401);
  });

  it("renvoie 404 pour une ressource inexistante (pas de fuite d'existence cross-tenant)", async () => {
    await authed(app, hotelA1Token).get("/api/v1/departments/does-not-exist").expect(404);
  });
});
