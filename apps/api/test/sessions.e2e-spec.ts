import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 7 (durcissement Auth) — vérifie la gestion des sessions via les endpoints réels : chaque
// login crée une session distincte (metadonnées visibles), révoquer une session ne touche jamais
// les autres, révoquer la session d'un autre utilisateur est impossible (404, pas 403 -- n'expose
// même pas l'existence de l'id), "déconnecter partout" révoque tout d'un coup. Regroupé pour rester
// sous le throttle de /auth/login (5/60s).
describe("Gestion des sessions", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let password: string;
  let accessTokenA1: string;
  let refreshTokenA1: string;
  let refreshTokenA2: string;
  let refreshTokenA3: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "sessions-org");
    email = tenant.email;
    password = tenant.password;

    // Login #1/4 — session A1.
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("User-Agent", "TestClient/A1")
      .send({ email, password })
      .expect(200);
    accessTokenA1 = login.body.accessToken as string;
    refreshTokenA1 = login.body.refreshToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("plusieurs connexions concurrentes créent des sessions distinctes, visibles avec leurs métadonnées", async () => {
    // Login #2/4 et #3/4 — sessions A2 et A3, simulant deux autres appareils/navigateurs.
    const loginA2 = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("User-Agent", "TestClient/A2")
      .send({ email, password })
      .expect(200);
    refreshTokenA2 = loginA2.body.refreshToken as string;

    const loginA3 = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("User-Agent", "TestClient/A3")
      .send({ email, password })
      .expect(200);
    refreshTokenA3 = loginA3.body.refreshToken as string;

    const sessions = await request(app.getHttpServer())
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${accessTokenA1}`)
      .expect(200);

    expect(sessions.body).toHaveLength(3);
    const userAgents = sessions.body.map((s: { userAgent: string }) => s.userAgent).sort();
    expect(userAgents).toEqual(["TestClient/A1", "TestClient/A2", "TestClient/A3"]);
    // Jamais de tokenHash exposé.
    expect(sessions.body[0]).not.toHaveProperty("tokenHash");
  });

  it("révoquer une session précise ne touche jamais les autres (isolation entre sessions concurrentes)", async () => {
    const sessions = await request(app.getHttpServer())
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${accessTokenA1}`)
      .expect(200);
    const sessionA2 = sessions.body.find((s: { userAgent: string }) => s.userAgent === "TestClient/A2");

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${sessionA2.id}`)
      .set("Authorization", `Bearer ${accessTokenA1}`)
      .expect(200);

    // A2 révoquée : son refresh token ne fonctionne plus.
    await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken: refreshTokenA2 }).expect(401);

    // A1 et A3 restent intactes.
    await request(app.getHttpServer())
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${accessTokenA1}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(2);
      });
  });

  it("révoquer la session d'un autre utilisateur est impossible (404, jamais 403)", async () => {
    const otherTenant = await createTenant(prisma, "sessions-org-other");
    // Login #4/4 — utilisateur B, sur une organisation distincte.
    const loginB = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: otherTenant.email, password: otherTenant.password })
      .expect(200);

    const sessionsB = await request(app.getHttpServer())
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${loginB.body.accessToken}`)
      .expect(200);
    const sessionBId = sessionsB.body[0].id as string;

    // A (accessTokenA1) tente de révoquer la session de B, en devinant son id.
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${sessionBId}`)
      .set("Authorization", `Bearer ${accessTokenA1}`)
      .expect(404);

    // La session de B fonctionne toujours -- la tentative de A n'a rien révoqué.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: loginB.body.refreshToken })
      .expect(200);
  });

  it("« déconnecter partout » révoque toutes les sessions restantes de l'utilisateur en un appel", async () => {
    const revokeAll = await request(app.getHttpServer())
      .delete("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${accessTokenA1}`)
      .expect(200);
    expect(revokeAll.body.revokedCount).toBe(2); // A1 + A3 (A2 déjà révoquée au test précédent)

    await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken: refreshTokenA1 }).expect(401);
    await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken: refreshTokenA3 }).expect(401);
  });
});
