import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 6 (Hardening) — vérifie AuthService.refreshTokens() (apps/api/src/modules/auth/
// auth.service.ts) : rotation normale ET détection de réutilisation (un refresh token déjà
// tourné qui resurgit signale un vol probable — révoque en cascade TOUTES les sessions actives
// de l'utilisateur, pas seulement le token rejoué).
describe("Rotation et détection de réutilisation des refresh tokens", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let password: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "auth-refresh-org");
    email = tenant.email;
    password = tenant.password;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rotation normale : le nouveau refresh token fonctionne, l'ancien est révoqué", async () => {
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(200);
    const tokenA = login.body.refreshToken as string;

    const refreshed = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: tokenA })
      .expect(200);
    const tokenB = refreshed.body.refreshToken as string;
    expect(tokenB).not.toBe(tokenA);

    // tokenA est désormais révoqué (rotation) : le réutiliser doit échouer — ET déclenche la
    // détection de réutilisation (révocation en cascade de toutes les sessions actives, y
    // compris tokenB, qui pourtant n'avait encore jamais servi).
    await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken: tokenA }).expect(401);

    // tokenB doit donc être rejeté lui aussi, alors qu'il n'avait jamais été présenté avant cet
    // instant — preuve que la cascade a bien eu lieu, pas seulement le rejet du token rejoué.
    await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken: tokenB }).expect(401);
  });

  it("une nouvelle connexion après la cascade fonctionne normalement (pas de verrouillage du compte)", async () => {
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(200);
  });
});
