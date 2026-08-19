import { INestApplication } from "@nestjs/common";
import * as OTPAuth from "otpauth";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 7 (durcissement Auth) — vérifie le flow 2FA complet via les endpoints réels : setup
// n'active rien tant qu'enable() n'a pas prouvé un vrai code, login exige ensuite le second
// facteur, les codes de récupération sont à usage unique, disable exige le mot de passe courant.
// Regroupé en un minimum d'appels à /auth/login : throttlé à 5/60s comme tout le reste du module
// auth, donc pas un login par scénario (setup/enable/disable réutilisent l'access token déjà
// obtenu plutôt que de se reconnecter).
describe("2FA (TOTP)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let password: string;
  let accessToken: string;
  let twoFactorSecret: string;
  let recoveryCodes: string[];

  function generateCode(base32Secret: string, userEmail: string): string {
    const totp = new OTPAuth.TOTP({
      issuer: "NimbaLodge",
      label: userEmail,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32Secret),
    });
    return totp.generate();
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "two-factor-org");
    email = tenant.email;
    password = tenant.password;

    // Login #1/5 — pas de 2FA actif encore : tokens normaux, pas de challenge.
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(200);
    expect(login.body.twoFactorRequired).toBeUndefined();
    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("setup ne change rien tant qu'enable n'a pas vérifié un vrai code ; mauvais code rejeté", async () => {
    const setup = await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(setup.body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.body.otpauthUrl).toContain("otpauth://totp/");

    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code: "000000" })
      .expect(400);

    twoFactorSecret = setup.body.secret as string;
  });

  it("enable avec le bon code active le 2FA et retourne 8 codes de récupération distincts", async () => {
    const validCode = generateCode(twoFactorSecret, email);
    const enabled = await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code: validCode })
      .expect(200);

    recoveryCodes = enabled.body.recoveryCodes as string[];
    expect(recoveryCodes).toHaveLength(8);
    expect(new Set(recoveryCodes).size).toBe(8);
  });

  it("login exige désormais le 2FA ; verify rejette un mauvais code puis accepte le bon TOTP", async () => {
    // Login #2/5 — 2FA actif : challenge, jamais de tokens réels directement.
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(200);
    expect(login.body.twoFactorRequired).toBe(true);
    expect(login.body.accessToken).toBeUndefined();
    const challengeToken = login.body.challengeToken as string;

    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ challengeToken, code: "000000" })
      .expect(401);

    const verified = await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ challengeToken, code: generateCode(twoFactorSecret, email) })
      .expect(200);
    expect(verified.body.accessToken).toBeDefined();
    expect(verified.body.refreshToken).toBeDefined();
  });

  it("un code de récupération fonctionne une seule fois", async () => {
    // Login #3/5.
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(200);
    const challengeToken = login.body.challengeToken as string;
    const recoveryCode = recoveryCodes[0];

    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ challengeToken, code: recoveryCode })
      .expect(200);

    // Même challenge (encore valide, non expiré), même code déjà consommé : doit échouer.
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ challengeToken, code: recoveryCode })
      .expect(401);
  });

  it("disable rejette un mauvais mot de passe, accepte le bon, et désactive réellement le 2FA", async () => {
    // Login #4/5 + verify pour obtenir un access token valide (2FA toujours actif à ce stade).
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(200);
    const verified = await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ challengeToken: login.body.challengeToken, code: generateCode(twoFactorSecret, email) })
      .expect(200);
    const currentAccessToken = verified.body.accessToken as string;

    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/disable")
      .set("Authorization", `Bearer ${currentAccessToken}`)
      .send({ password: "mauvais-mot-de-passe" })
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/disable")
      .set("Authorization", `Bearer ${currentAccessToken}`)
      .send({ password })
      .expect(200);

    // Login #5/5 — le 2FA n'est plus exigé.
    const finalLogin = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(200);
    expect(finalLogin.body.twoFactorRequired).toBeUndefined();
    expect(finalLogin.body.accessToken).toBeDefined();
  });
});
