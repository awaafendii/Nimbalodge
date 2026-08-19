import { INestApplication } from "@nestjs/common";
import jwt from "jsonwebtoken";
import request from "supertest";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 7 (durcissement, Priority 8) — couvre les scénarios du volet "Tests de sécurité" du brief
// qui ne sont pas déjà exercés ailleurs : la plupart des items (isolation multi-hôtel/département,
// RBAC, upload dangereux, audit, erreurs d'autorisation) sont déjà couverts par
// multi-tenant-isolation, department-scope, documents et audit-logs e2e-spec.ts — voir chacun pour
// le détail. Ce fichier ferme les deux angles qui manquaient : expiration/falsification de token
// d'accès, et injection (SQL et traversée de chemin).
describe("Durcissement sécurité — tokens et injection", () => {
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

  describe("Token d'accès expiré ou falsifié", () => {
    it("rejette un token d'accès expiré (401), même avec une signature valide", async () => {
      const expiredToken = jwt.sign(
        { sub: "user-1", organizationId: "org-1", hotelId: null },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "-10s" }
      );

      await request(app.getHttpServer())
        .get("/api/v1/hotels")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);
    });

    it("rejette un token signé avec une mauvaise clé (signature invalide)", async () => {
      const forgedToken = jwt.sign(
        { sub: "user-1", organizationId: "org-1", hotelId: null },
        "clé-incorrecte-jamais-utilisée-en-vrai",
        { expiresIn: "15m" }
      );

      await request(app.getHttpServer())
        .get("/api/v1/hotels")
        .set("Authorization", `Bearer ${forgedToken}`)
        .expect(401);
    });

    it("rejette un token de rafraîchissement présenté comme token d'accès (secrets distincts)", async () => {
      const refreshShapedToken = jwt.sign(
        { sub: "user-1", organizationId: "org-1", hotelId: null },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "15m" }
      );

      await request(app.getHttpServer())
        .get("/api/v1/hotels")
        .set("Authorization", `Bearer ${refreshShapedToken}`)
        .expect(401);
    });
  });

  describe("Injection SQL", () => {
    it("un payload de type injection SQL dans les identifiants de connexion échoue proprement (jamais 500 ni contournement)", async () => {
      // Ces deux payloads n'ont pas la forme d'un email : rejetés par @IsEmail() (ValidationPipe,
      // 400) avant même d'atteindre AuthService — la couche la plus en amont possible, meilleure
      // défense que de laisser la requête atteindre Prisma pour constater qu'elle échoue proprement.
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "' OR '1'='1' -- ", password: "' OR '1'='1' -- " })
        .expect(400);

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "admin'; DROP TABLE \"User\"; --", password: "peu importe" })
        .expect(400);

      // Un email syntaxiquement valide mais inexistant portant une intention d'injection dans le mot
      // de passe atteint bien AuthService/Prisma (requête paramétrée) — 401 générique, jamais un
      // contournement ni une erreur serveur.
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "injection-test@example.com", password: "' OR '1'='1' -- " })
        .expect(401);
    });

    it("un payload de type injection SQL dans les filtres de recherche du journal d'audit ne casse rien et ne fuite rien (Prisma paramétré)", async () => {
      const tenant = await createTenant(prisma, "security-injection-org");
      const token = await loginAndGetToken(app, tenant.email, tenant.password);
      const client = authed(app, token);

      const bySearch = await client
        .get(`/api/v1/audit-logs?search=${encodeURIComponent("'; DROP TABLE \"AuditLog\"; --")}`)
        .expect(200);
      expect(Array.isArray(bySearch.body.items)).toBe(true);

      const byResourceType = await client
        .get(`/api/v1/audit-logs?resourceType=${encodeURIComponent("' OR '1'='1")}`)
        .expect(200);
      expect(byResourceType.body.items).toEqual([]);

      // La table AuditLog existe toujours après les tentatives ci-dessus — la moindre injection
      // aurait fait échouer cette requête normale.
      await client.get("/api/v1/audit-logs").expect(200);
    });
  });

  describe("Traversée de chemin dans les noms de fichiers uploadés", () => {
    it("assainit un nom de fichier contenant des séparateurs de chemin, sans jamais échouer ni sortir du stockage prévu", async () => {
      const tenant = await createTenant(prisma, "security-path-traversal-org");
      const token = await loginAndGetToken(app, tenant.email, tenant.password);
      const client = authed(app, token);

      const category = await prisma.financialCategory.create({
        data: { hotelId: tenant.hotelId, name: "Test sécurité", type: "EXPENSE" },
      });
      const expense = await client
        .post("/api/v1/expenses")
        .send({ amount: 15000, categoryId: category.id, paymentMethod: "CASH" })
        .expect(201);

      const uploaded = await request(app.getHttpServer())
        .post(`/api/v1/documents/expenses/${expense.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("%PDF-1.4"), {
          filename: "../../../../etc/passwd",
          contentType: "application/pdf",
        })
        .expect(201);

      // Séparateurs de chemin neutralisés — jamais interprété comme un déplacement de répertoire.
      expect(uploaded.body.filename).not.toContain("/");
      expect(uploaded.body.filename).not.toContain("\\");

      // Le fichier reste malgré tout accessible normalement (aucune corruption du chemin réel de
      // stockage, qui n'est jamais dérivé du nom de fichier — voir documents.service.ts).
      const downloaded = await request(app.getHttpServer())
        .get(`/api/v1/documents/${uploaded.body.id}/content`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(downloaded.body.toString()).toBe("%PDF-1.4");
    });
  });
});
