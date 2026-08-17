import { INestApplication } from "@nestjs/common";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 6 (Offline) — vérifie IdempotencyInterceptor (apps/api/src/common/interceptors/
// idempotency.interceptor.ts) : rejouer une mutation avec la même clé Idempotency-Key ne doit
// jamais l'appliquer deux fois côté serveur (essentiel pour la synchronisation après une période
// hors ligne, où le client ne sait pas toujours si sa requête précédente a abouti). Utilise
// POST /attendances (pointage d'arrivée) comme mutation cible réelle — un create simple avec corps
// JSON, représentatif des mutations des domaines pilotes offline.
describe("Idempotence des mutations (IdempotencyInterceptor)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let employeeId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "idempotency-org");
    token = await loginAndGetToken(app, tenant.email, tenant.password);

    const employee = await authed(app, token)
      .post("/api/v1/employees")
      .send({ firstName: "Test", lastName: "Idempotence", baseSalary: 1000000 })
      .expect(201);
    employeeId = employee.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("sans en-tête Idempotency-Key : comportement inchangé, chaque appel crée une nouvelle ressource", async () => {
    const first = await authed(app, token)
      .post("/api/v1/attendances")
      .send({ employeeId })
      .expect(201);
    await authed(app, token).post(`/api/v1/attendances/${first.body.id}/clock-out`).expect(201);

    const second = await authed(app, token)
      .post("/api/v1/attendances")
      .send({ employeeId })
      .expect(201);
    await authed(app, token).post(`/api/v1/attendances/${second.body.id}/clock-out`).expect(201);

    expect(second.body.id).not.toBe(first.body.id);
  });

  it("avec la même clé Idempotency-Key : la deuxième requête renvoie la réponse originale sans créer de doublon", async () => {
    const idempotencyKey = "test-idempotency-key-clock-in-1";

    const countBefore = await prisma.attendance.count({ where: { employeeId } });

    const first = await authed(app, token)
      .post("/api/v1/attendances")
      .set("Idempotency-Key", idempotencyKey)
      .send({ employeeId })
      .expect(201);

    const replay = await authed(app, token)
      .post("/api/v1/attendances")
      .set("Idempotency-Key", idempotencyKey)
      .send({ employeeId })
      .expect(201);

    // Même corps de réponse exactement (l'id de l'enregistrement créé une seule fois).
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body).toEqual(first.body);

    const countAfter = await prisma.attendance.count({ where: { employeeId } });
    expect(countAfter - countBefore).toBe(1);

    const idempotencyRows = await prisma.idempotencyKey.count({
      where: { key: idempotencyKey },
    });
    expect(idempotencyRows).toBe(1);

    await authed(app, token).post(`/api/v1/attendances/${first.body.id}/clock-out`).expect(201);
  });

  it("une clé Idempotency-Key différente exécute une mutation normale et distincte", async () => {
    const a = await authed(app, token)
      .post("/api/v1/attendances")
      .set("Idempotency-Key", "test-idempotency-key-clock-in-2a")
      .send({ employeeId })
      .expect(201);
    const b = await authed(app, token)
      .post("/api/v1/attendances")
      .set("Idempotency-Key", "test-idempotency-key-clock-in-2b")
      .send({ employeeId })
      .expect(409); // un pointage est déjà ouvert pour cet employé (comportement métier normal, pas lié à l'idempotence)

    expect(b.body.message).toContain("pointage");
    await authed(app, token).post(`/api/v1/attendances/${a.body.id}/clock-out`).expect(201);
  });

  it("la même clé utilisée par un autre utilisateur n'obtient jamais la réponse mise en cache", async () => {
    const tenant = await createTenant(prisma, "idempotency-org-2");
    const otherToken = await loginAndGetToken(app, tenant.email, tenant.password);
    const otherEmployee = await authed(app, otherToken)
      .post("/api/v1/employees")
      .send({ firstName: "Autre", lastName: "Utilisateur", baseSalary: 900000 })
      .expect(201);

    const sharedKey = "test-idempotency-key-shared-across-users";

    const mine = await authed(app, token)
      .post("/api/v1/attendances")
      .set("Idempotency-Key", sharedKey)
      .send({ employeeId })
      .expect(201);

    const theirs = await authed(app, otherToken)
      .post("/api/v1/attendances")
      .set("Idempotency-Key", sharedKey)
      .send({ employeeId: otherEmployee.body.id })
      .expect(201);

    expect(theirs.body.id).not.toBe(mine.body.id);
    expect(theirs.body.employeeId).toBe(otherEmployee.body.id);

    await authed(app, token).post(`/api/v1/attendances/${mine.body.id}/clock-out`).expect(201);
    await authed(app, otherToken).post(`/api/v1/attendances/${theirs.body.id}/clock-out`).expect(201);
  });
});
