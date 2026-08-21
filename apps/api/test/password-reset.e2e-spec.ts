import { INestApplication } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";
import { FakeEmailProvider } from "../src/modules/email/providers/fake-email.provider";

// Étape 7 (durcissement Auth) — vérifie PasswordResetService via les endpoints réels : pas de
// fuite d'existence de compte, token unique et hashé en base, expiration, usage unique, et
// révocation de toutes les sessions actives après un reset réussi (voir password-reset.service.ts).
// Regroupé en un minimum d'appels à /password-reset/request : throttlé à 3/60s (protection
// anti-énumération volontairement stricte), donc pas un appel par scénario.
describe("Réinitialisation de mot de passe", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeEmailProvider: FakeEmailProvider;
  let email: string;
  let password: string;
  let userId: string;

  // Aucun fournisseur d'email n'est branché (décision produit, Étape 7) : le token brut est
  // uniquement écrit dans les logs serveur (via PinoLogger, voir password-reset.service.ts), jamais
  // retourné par l'API — on l'intercepte ici en espionnant PinoLogger.prototype.info directement
  // (plutôt que stdout/console.log, qui passe par un transport pino-pretty asynchrone en environnement
  // de test et ne serait pas fiable à intercepter de façon synchrone).
  function captureResetToken(spy: jest.SpyInstance): string {
    const call = spy.mock.calls.find((args) => typeof args[0] === "object" && typeof (args[0] as { token?: unknown }).token === "string");
    if (!call) throw new Error("Aucun lien de réinitialisation n'a été loggé");
    return (call[0] as { token: string }).token;
  }

  async function requestReset(targetEmail: string): Promise<string | null> {
    const infoSpy = jest.spyOn(PinoLogger.prototype, "info").mockImplementation(() => undefined);
    try {
      await request(app.getHttpServer()).post("/api/v1/auth/password-reset/request").send({ email: targetEmail }).expect(200);
      const call = infoSpy.mock.calls.find((args) => typeof args[0] === "object" && typeof (args[0] as { token?: unknown }).token === "string");
      return call ? captureResetToken(infoSpy) : null;
    } finally {
      infoSpy.mockRestore();
    }
  }

  beforeAll(async () => {
    ({ app, prisma, fakeEmailProvider } = await createTestApp());
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

// Email réel (suite Étape 7) — décrit séparément pour garder son propre budget de throttle
// (3/60s sur /password-reset/request, voir le describe ci-dessus) : un seul appel ici, avec le
// fournisseur configuré via FakeEmailProvider (jamais un vrai appel Brevo, voir test-app.ts).
describe("Réinitialisation de mot de passe — email réellement envoyé (fournisseur configuré)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeEmailProvider: FakeEmailProvider;

  beforeAll(async () => {
    ({ app, prisma, fakeEmailProvider } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("envoie un vrai email avec le lien de réinitialisation quand un fournisseur est configuré, jamais un log", async () => {
    const tenant = await createTenant(prisma, "password-reset-email-org");
    fakeEmailProvider.setConfigured(true);

    const infoSpy = jest.spyOn(PinoLogger.prototype, "info").mockImplementation(() => undefined);
    try {
      await request(app.getHttpServer()).post("/api/v1/auth/password-reset/request").send({ email: tenant.email }).expect(200);
      expect(infoSpy).not.toHaveBeenCalled();
    } finally {
      infoSpy.mockRestore();
    }

    expect(fakeEmailProvider.sentEmails).toHaveLength(1);
    const sent = fakeEmailProvider.sentEmails[0]!;
    expect(sent.to).toBe(tenant.email);
    expect(sent.html).toContain("/reset-password?token=");
  });
});
