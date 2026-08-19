import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, createUserInHotel, seedPermissionCatalog } from "./support/fixtures";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 7 (architecture d'upload) — vérifie DocumentsService via les endpoints réels : upload
// valide, type MIME dangereux rejeté, permission insuffisante rejetée, isolation inter-hôtel
// (accès à un document d'un autre hôtel refusé), suppression réelle (le fichier redevient
// introuvable après DELETE, pas seulement masqué côté liste).
describe("Documents (upload sécurisé)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokenA: string;
  let expenseId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenantA = await createTenant(prisma, "documents-org-a");
    const loginA = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: tenantA.email, password: tenantA.password })
      .expect(200);
    accessTokenA = loginA.body.accessToken as string;

    const category = await prisma.financialCategory.create({
      data: { hotelId: tenantA.hotelId, name: "Test", type: "EXPENSE" },
    });
    const created = await request(app.getHttpServer())
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${accessTokenA}`)
      .send({ amount: 50000, categoryId: category.id, paymentMethod: "CASH" })
      .expect(201);
    expenseId = created.body.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it("upload un PDF valide : apparaît dans la liste, contenu identique au téléchargement", async () => {
    const content = Buffer.from("%PDF-1.4 contenu de test");
    const uploaded = await request(app.getHttpServer())
      .post(`/api/v1/documents/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${accessTokenA}`)
      .attach("file", content, { filename: "facture.pdf", contentType: "application/pdf" })
      .expect(201);
    expect(uploaded.body.filename).toBe("facture.pdf");

    const list = await request(app.getHttpServer())
      .get(`/api/v1/documents/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${accessTokenA}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(uploaded.body.id);

    const downloaded = await request(app.getHttpServer())
      .get(`/api/v1/documents/${uploaded.body.id}/content`)
      .set("Authorization", `Bearer ${accessTokenA}`)
      .expect(200);
    expect(downloaded.body.toString()).toBe(content.toString());
    expect(downloaded.headers["content-type"]).toContain("application/pdf");
  });

  it("rejette un type de fichier dangereux (exécutable, pas dans la liste blanche)", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/documents/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${accessTokenA}`)
      .attach("file", Buffer.from("MZ\x90\x00"), { filename: "malware.exe", contentType: "application/x-msdownload" })
      .expect(400);
  });

  it("rejette un upload sans la permission requise (même hôtel, rôle restreint)", async () => {
    const tenantA = await prisma.user.findFirstOrThrow({ where: { email: { contains: "documents-org-a" } } });
    const limitedRole = await prisma.role.create({
      data: { name: "LIMITED_DOCS", organizationId: tenantA.organizationId, isSystem: false },
    });
    const viewPermission = await prisma.permission.findUniqueOrThrow({ where: { key: "finance-expenses.view" } });
    await prisma.rolePermission.create({ data: { roleId: limitedRole.id, permissionId: viewPermission.id } });
    const limitedUser = await createUserInHotel(
      prisma,
      tenantA.organizationId,
      limitedRole.id,
      tenantA.hotelId!,
      "documents-limited"
    );
    const loginLimited = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: limitedUser.email, password: limitedUser.password })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/documents/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${loginLimited.body.accessToken}`)
      .attach("file", Buffer.from("%PDF-1.4"), { filename: "facture.pdf", contentType: "application/pdf" })
      .expect(403);
  });

  it("refuse l'accès à un document d'un autre hôtel (isolation inter-hôtel)", async () => {
    const tenantB = await createTenant(prisma, "documents-org-b");
    const loginB = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: tenantB.email, password: tenantB.password })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/documents/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${loginB.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/documents/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${loginB.body.accessToken}`)
      .attach("file", Buffer.from("%PDF-1.4"), { filename: "intrusion.pdf", contentType: "application/pdf" })
      .expect(403);
  });

  it("supprime réellement le document : introuvable ensuite, plus dans la liste", async () => {
    const uploaded = await request(app.getHttpServer())
      .post(`/api/v1/documents/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${accessTokenA}`)
      .attach("file", Buffer.from("%PDF-1.4 second document"), { filename: "second.pdf", contentType: "application/pdf" })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/documents/${uploaded.body.id}`)
      .set("Authorization", `Bearer ${accessTokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/documents/${uploaded.body.id}/content`)
      .set("Authorization", `Bearer ${accessTokenA}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/documents/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${accessTokenA}`)
      .expect(200);
    expect(list.body.find((d: { id: string }) => d.id === uploaded.body.id)).toBeUndefined();
  });
});
