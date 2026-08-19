import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 7 (durcissement Auth) — vérifie PasswordResetService via les endpoints réels : pas de
// fuite d'existence de compte, token unique et hashé en base, expiration, usage unique, et
// révocation de toutes les sessions actives après un reset réussi (voir password-reset.service.ts).
// Regroupé en un minimum d'appels à /password-reset/request : throttlé à 3/60s (protection
// anti-énumération volontairement stricte), donc pas un appel par scénario.
describe("Réinitialisation de mot de passe", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let password: string;
  let userId: string;

  // Aucun fournisseur d'email n'est branché (décision produit, Étape 7) : le token brut est
  // uniquement écrit dans les logs serveur, jamais retourné par l'API — on l'intercepte ici via un
  // espion sur console.log, exactement comme un opérateur le lirait dans les logs réels.
  function captureResetToken(spy: jest.SpyInstance): string {
    const call = spy.mock.calls.find((args) => typeof args[0] === "string" && args[0].includes("[PasswordReset]"));
    if (!call) throw new Error("Aucun lien de réinitialisation n'a été loggé");
    const match = /token=([a-f0-9]+)/.exec(call[0] as string);
    const token = match?.[1];
    if (!token) throw new Error("Token introuvable dans le message loggé");
    return token;
  }

  async function requestReset(targetEmail: string): Promise<string | null> {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await request(app.getHttpServer()).post("/api/v1/auth/password-reset/request").send({ email: targetEmail }).expect(200);
      const call = logSpy.mock.calls.find((args) => typeof args[0] === "string" && args[0].includes("[PasswordReset]"));
      return call ? captureResetToken(logSpy) : null;
    } finally {
      logSpy.mockRestore();
    }
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "password-reset-org");
    email = tenant.email;
    password = tenant.password;
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userId = user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("répond succès générique et ne journalise aucun token pour un email inconnu (anti-énumération)", async () => {
    const token = await requestReset("inconnu@example.com");
    expect(token).toBeNull();
  });

  it("reset complet : token créé, mot de passe changé, sessions révoquées, token à usage unique", async () => {
    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(200);
    const activeRefreshToken = login.body.refreshToken as string;

    const rawToken = await requestReset(email);
    expect(rawToken).not.toBeNull();

    const newPassword = "NouveauMotDePasse123!";
    await request(app.getHttpServer())
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token: rawToken, newPassword })
      .expect(200);

    // Ancien mot de passe rejeté, nouveau accepté.
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password }).expect(401);
    await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: newPassword }).expect(200);

    // La session ouverte AVANT le reset est révoquée par le reset.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: activeRefreshToken })
      .expect(401);

    // Usage unique : rejouer le même token échoue, même avec un mot de passe différent.
    await request(app.getHttpServer())
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token: rawToken, newPassword: "AutreMotDePasse456!" })
      .expect(400);

    password = newPassword; // pour le test suivant
  });

  it("rejette un token expiré ou totalement inconnu", async () => {
    const rawToken = await requestReset(email);
    expect(rawToken).not.toBeNull();

    // Force l'expiration du token fraîchement créé directement en base (le token étant hashé, on
    // ne peut le récupérer que via ce qu'on vient de créer côté test).
    await prisma.passwordResetToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer())
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token: rawToken, newPassword: "PeuImporte123!" })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token: "0".repeat(64), newPassword: "PeuImporte123!" })
      .expect(400);
  });
});
