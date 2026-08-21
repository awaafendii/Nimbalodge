import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { resetDatabase } from "./support/database";
import {
  addHotelMembership,
  createHotelMembershipUser,
  createHotelUser,
  createOrganizationWithRole,
  createRole,
  seedPermissionCatalog,
} from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// AuditService.record() est fire-and-forget (voir common/audit/audit.service.ts — écriture
// .catch()-ée, jamais awaited par les appelants) : la réponse HTTP peut arriver avant que la ligne
// AuditLog soit committée. On sonde donc au lieu de lire immédiatement après la requête.
async function waitForAuditLog(prisma: PrismaService, where: Record<string, unknown>, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: "desc" } });
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`AuditLog introuvable pour ${JSON.stringify(where)} après ${timeoutMs}ms`);
}

// Couvre le nouveau modèle HotelMembership et l'endpoint POST /auth/switch-hotel (RBAC
// multi-hôtel) : un utilisateur peut avoir un rôle différent par hôtel, le switch réémet des
// tokens dont le hotelId actif est toujours revalidé côté serveur contre une membership ACTIVE
// réelle (jamais accepté tel quel depuis le client), et chaque tentative — succès ou refus — est
// auditée. Complète multi-tenant-isolation.e2e-spec.ts (assertInScope, chemin UserRole/User.hotelId
// historique) sans le dupliquer : ici on teste spécifiquement le chemin HotelMembership.
describe("RBAC multi-hôtel (HotelMembership + switch-hotel)", () => {
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

  it("un utilisateur avec une seule HotelMembership n'a accès qu'à cet hôtel et ne peut pas switcher ailleurs", async () => {
    const org = await createOrganizationWithRole(prisma, "hm-single", ["reservations.view"]);
    const hotelA = await createHotelUser(prisma, org.organizationId, org.roleId, "hm-single-a");
    const hotelB = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "HM Single B", slug: "hm-single-b" },
    });
    const member = await createHotelMembershipUser(prisma, org.organizationId, hotelA.hotelId, org.roleId, "single");
    const token = await loginAndGetToken(app, member.email, member.password);

    const me = await authed(app, token).get("/api/v1/auth/me").expect(200);
    expect(me.body.hotel.id).toBe(hotelA.hotelId);
    expect(me.body.hotels).toEqual([{ id: hotelA.hotelId, name: "hm-single-a", role: expect.any(String) }]);

    await authed(app, token).get("/api/v1/reservations").expect(200);

    const switchResponse = await authed(app, token).post("/api/v1/auth/switch-hotel").send({ hotelId: hotelB.id });
    expect(switchResponse.status).toBe(403);

    const failureLog = await waitForAuditLog(prisma, {
      userId: member.userId,
      action: "switch-hotel",
      outcome: "FAILURE",
    });
    expect(failureLog.hotelId).toBe(hotelB.id);
    expect(failureLog.errorMessage).toContain("affectation active");
  });

  it("un utilisateur avec un rôle différent par hôtel voit ses permissions changer après switch-hotel, sans fuite de l'ancien hôtel", async () => {
    const org = await createOrganizationWithRole(prisma, "hm-diff-roles", []);
    const hotelA = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "HM Diff A", slug: "hm-diff-a" },
    });
    const hotelB = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "HM Diff B", slug: "hm-diff-b" },
    });
    const roleFinance = await createRole(prisma, org.organizationId, "TEST_FINANCE", ["finance-revenues.view"]);
    const roleReception = await createRole(prisma, org.organizationId, "TEST_RECEPTION", ["reservations.view"]);

    const member = await createHotelMembershipUser(prisma, org.organizationId, hotelA.id, roleFinance, "diff-roles");
    await addHotelMembership(prisma, member.userId, hotelB.id, roleReception);

    let token = await loginAndGetToken(app, member.email, member.password);

    // Hôtel A actif (rôle finance) : accès recettes, pas réservations.
    await authed(app, token).get("/api/v1/revenues").expect(200);
    await authed(app, token).get("/api/v1/reservations").expect(403);

    const switchResponse = await authed(app, token).post("/api/v1/auth/switch-hotel").send({ hotelId: hotelB.id }).expect(200);
    token = switchResponse.body.accessToken;

    // Hôtel B actif (rôle réception) : accès réservations, plus aux recettes de l'hôtel A.
    await authed(app, token).get("/api/v1/reservations").expect(200);
    await authed(app, token).get("/api/v1/revenues").expect(403);

    const me = await authed(app, token).get("/api/v1/auth/me").expect(200);
    expect(me.body.hotel.id).toBe(hotelB.id);
    expect(me.body.hotels.map((h: { id: string }) => h.id).sort()).toEqual([hotelA.id, hotelB.id].sort());

    await waitForAuditLog(prisma, {
      userId: member.userId,
      action: "switch-hotel",
      outcome: "SUCCESS",
      hotelId: hotelB.id,
    });
  });

  it("refuse le switch-hotel vers une HotelMembership SUSPENDED (403, sans réémission de tokens)", async () => {
    const org = await createOrganizationWithRole(prisma, "hm-suspended", ["reservations.view"]);
    const hotelA = await createHotelUser(prisma, org.organizationId, org.roleId, "hm-suspended-a");
    const hotelB = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "HM Suspended B", slug: "hm-suspended-b" },
    });
    const member = await createHotelMembershipUser(prisma, org.organizationId, hotelA.hotelId, org.roleId, "suspended");
    await addHotelMembership(prisma, member.userId, hotelB.id, org.roleId, "SUSPENDED");

    const token = await loginAndGetToken(app, member.email, member.password);

    const me = await authed(app, token).get("/api/v1/auth/me").expect(200);
    // La membership SUSPENDED n'apparaît pas dans la liste des hôtels accessibles.
    expect(me.body.hotels).toEqual([{ id: hotelA.hotelId, name: "hm-suspended-a", role: expect.any(String) }]);

    const switchResponse = await authed(app, token).post("/api/v1/auth/switch-hotel").send({ hotelId: hotelB.id });
    expect(switchResponse.status).toBe(403);

    await waitForAuditLog(prisma, { userId: member.userId, action: "switch-hotel", outcome: "FAILURE", hotelId: hotelB.id });
  });

  it("refuse le switch-hotel vers un hôtel d'une autre organisation, même en connaissant son id", async () => {
    const orgA = await createOrganizationWithRole(prisma, "hm-cross-org-a", ["reservations.view"]);
    const hotelA = await createHotelUser(prisma, orgA.organizationId, orgA.roleId, "hm-cross-org-a-hotel");
    const orgB = await createOrganizationWithRole(prisma, "hm-cross-org-b", ["reservations.view"]);
    const hotelB = await createHotelUser(prisma, orgB.organizationId, orgB.roleId, "hm-cross-org-b-hotel");

    const member = await createHotelMembershipUser(prisma, orgA.organizationId, hotelA.hotelId, orgA.roleId, "cross-org");
    const token = await loginAndGetToken(app, member.email, member.password);

    const switchResponse = await authed(app, token).post("/api/v1/auth/switch-hotel").send({ hotelId: hotelB.hotelId });
    expect(switchResponse.status).toBe(403);

    // Le token d'origine (hôtel A) reste valable et scopé à l'organisation A.
    await authed(app, token).get("/api/v1/reservations").expect(200);
  });

  it("un profil multi-hôtel (type Boss) accède à ses 3 hôtels et bascule librement entre eux", async () => {
    const org = await createOrganizationWithRole(prisma, "hm-boss", []);
    const hotel1 = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "HM Boss 1", slug: "hm-boss-1" },
    });
    const hotel2 = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "HM Boss 2", slug: "hm-boss-2" },
    });
    const hotel3 = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "HM Boss 3", slug: "hm-boss-3" },
    });
    const bossRole = await createRole(prisma, org.organizationId, "TEST_BOSS", ["reservations.view", "finance-revenues.view"]);

    const boss = await createHotelMembershipUser(prisma, org.organizationId, hotel1.id, bossRole, "boss");
    await addHotelMembership(prisma, boss.userId, hotel2.id, bossRole);
    await addHotelMembership(prisma, boss.userId, hotel3.id, bossRole);

    let token = await loginAndGetToken(app, boss.email, boss.password);
    const me = await authed(app, token).get("/api/v1/auth/me").expect(200);
    expect(me.body.hotels.map((h: { id: string }) => h.id).sort()).toEqual([hotel1.id, hotel2.id, hotel3.id].sort());

    for (const target of [hotel2, hotel3, hotel1]) {
      const switchResponse = await authed(app, token).post("/api/v1/auth/switch-hotel").send({ hotelId: target.id }).expect(200);
      token = switchResponse.body.accessToken;
      const meAfterSwitch = await authed(app, token).get("/api/v1/auth/me").expect(200);
      expect(meAfterSwitch.body.hotel.id).toBe(target.id);
      await authed(app, token).get("/api/v1/reservations").expect(200);
    }
  });

  it("refuse 401 sur /auth/switch-hotel sans token", async () => {
    const org = await createOrganizationWithRole(prisma, "hm-no-token", []);
    const hotelA = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "HM No Token A", slug: "hm-no-token-a" },
    });

    await request(app.getHttpServer()).post("/api/v1/auth/switch-hotel").send({ hotelId: hotelA.id }).expect(401);
  });
});
