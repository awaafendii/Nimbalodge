import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 7 (durcissement, Priority 6) — vérifie les endpoints de supervision ajoutés à HealthModule :
// /health (alias readiness, contrat render.yaml healthCheckPath inchangé), /health/live (pas de
// dépendance DB), /health/ready, et /health/metrics (donnée plateforme transverse, gardée par la
// permission system-monitoring.view — voir health.controller.ts et permissions-catalog.ts).
describe("Supervision (health + métriques)", () => {
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

  it("GET /health répond ok avec la connectivité DB (alias readiness, public)", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({ status: "ok", database: "connected", timestamp: expect.any(String) })
    );
  });

  it("GET /health/live répond ok sans vérifier la DB (public)", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health/live").expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({ status: "ok", uptimeSeconds: expect.any(Number), timestamp: expect.any(String) })
    );
  });

  it("GET /health/ready répond ok avec la connectivité DB (public)", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health/ready").expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({ status: "ok", database: "connected", timestamp: expect.any(String) })
    );
  });

  it("GET /health/metrics rejette une requête non authentifiée", async () => {
    await request(app.getHttpServer()).get("/api/v1/health/metrics").expect(401);
  });

  it("GET /health/metrics rejette un utilisateur sans la permission system-monitoring.view", async () => {
    const limitedTenant = await createTenant(prisma, "metrics-limited-org", ["hotels.view"]);
    const token = await loginAndGetToken(app, limitedTenant.email, limitedTenant.password);

    await authed(app, token).get("/api/v1/health/metrics").expect(403);
  });

  it("GET /health/metrics retourne la volumétrie/latence/mémoire pour un utilisateur autorisé", async () => {
    const fullTenant = await createTenant(prisma, "metrics-full-org");
    const token = await loginAndGetToken(app, fullTenant.email, fullTenant.password);

    // Génère au moins une requête mesurable avant de lire le snapshot.
    await request(app.getHttpServer()).get("/api/v1/health/live");

    const response = await authed(app, token).get("/api/v1/health/metrics").expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        uptimeSeconds: expect.any(Number),
        memory: expect.objectContaining({
          rssMb: expect.any(Number),
          heapUsedMb: expect.any(Number),
          heapTotalMb: expect.any(Number),
        }),
        requests: expect.objectContaining({ total: expect.any(Number), byStatusClass: expect.any(Object) }),
        errors: expect.objectContaining({ total5xx: expect.any(Number), ratePercent: expect.any(Number) }),
        latencyMs: expect.objectContaining({ avg: expect.any(Number), p95: expect.any(Number) }),
      })
    );
    expect(response.body.requests.total).toBeGreaterThan(0);
  });
});
