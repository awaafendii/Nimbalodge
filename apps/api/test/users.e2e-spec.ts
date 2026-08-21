import { INestApplication } from "@nestjs/common";

import { resetDatabase } from "./support/database";
import { createHotelUser, createOrganizationWithRole, createRole, createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// seedPermissionCatalog() ne crée que le catalogue de Permission (voir support/fixtures.ts) — le
// rôle global SUPER_ADMIN, lui, vient normalement de prisma/seed.ts (jamais exécuté en e2e).
// Reconstruit ici a minima (findFirst + create manuel, même contournement que seed.ts : Prisma
// Client refuse un upsert sur clé composée avec organizationId: null) — uniquement la permission
// nécessaire à ces tests (users.create, pour agir comme demandeur org-wide).
async function ensureSuperAdminRole(prisma: PrismaService): Promise<string> {
  let role = await prisma.role.findFirst({ where: { organizationId: null, name: "SUPER_ADMIN" } });
  if (!role) {
    role = await prisma.role.create({ data: { name: "SUPER_ADMIN", organizationId: null, isSystem: true } });
  }
  const usersCreatePermission = await prisma.permission.findUniqueOrThrow({ where: { key: "users.create" } });
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: usersCreatePermission.id } },
    update: {},
    create: { roleId: role.id, permissionId: usersCreatePermission.id },
  });
  return role.id;
}

// RBAC multi-hôtel (audit RBAC multi-hôtel, correctif création d'utilisateurs) — POST /users
// n'avait jamais eu de couverture e2e avant cette étape ; couvre spécifiquement le passage de
// UserRole (bug : permission globale, non scopée à un hôtel) à HotelMembership (comportement
// attendu : un rôle métier par hôtel, cohérent avec tout le reste du RBAC multi-hôtel). Deux
// describe séparés (deux budgets de throttle indépendants sur /auth/login, 5/60s) — voir
// nimba-ai-hotel-membership.e2e-spec.ts pour le même découpage.
describe("Utilisateurs — POST /users", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminRoleId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);
    superAdminRoleId = await ensureSuperAdminRole(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("crée un utilisateur avec une vraie HotelMembership (jamais un UserRole) — effective au login, invisible ailleurs", async () => {
    const org = await createOrganizationWithRole(prisma, "users-create-org", ["users.view", "users.create", "roles.view"]);
    const admin = await createHotelUser(prisma, org.organizationId, org.roleId, "users-create-hotel-a");
    const receptionRole = await createRole(prisma, org.organizationId, "TEST_RECEPTION_CREATE", ["reservations.view"]);

    const adminToken = await loginAndGetToken(app, admin.email, admin.password);
    const client = authed(app, adminToken);

    const created = await client
      .post("/api/v1/users")
      .send({
        email: "nouveau.membre@users-create-org.test",
        password: "MotDePasseReel123!",
        firstName: "Nouveau",
        lastName: "Membre",
        roleId: receptionRole,
      })
      .expect(201);

    expect(created.body.hotelMemberships).toEqual([
      expect.objectContaining({ hotelId: admin.hotelId, roleId: receptionRole, status: "ACTIVE" }),
    ]);

    // Preuve directe en base : aucune ligne UserRole créée pour ce nouvel utilisateur — uniquement
    // HotelMembership, contrairement au comportement avant ce correctif.
    const userRoles = await prisma.userRole.findMany({ where: { userId: created.body.id } });
    expect(userRoles).toEqual([]);
    const memberships = await prisma.hotelMembership.findMany({ where: { userId: created.body.id } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.hotelId).toBe(admin.hotelId);

    // Le rôle est immédiatement effectif : reservations.view accordé, rien d'autre.
    const newToken = await loginAndGetToken(app, "nouveau.membre@users-create-org.test", "MotDePasseReel123!");
    await authed(app, newToken).get("/api/v1/reservations").expect(200);
    await authed(app, newToken).get("/api/v1/users").expect(403);
  });

  it("refuse la création avec un rôle plateforme (SUPER_ADMIN, organizationId null)", async () => {
    const org = await createOrganizationWithRole(prisma, "users-create-platform-org", ["users.create"]);
    const admin = await createHotelUser(prisma, org.organizationId, org.roleId, "users-create-platform-hotel");
    const adminToken = await loginAndGetToken(app, admin.email, admin.password);

    await authed(app, adminToken)
      .post("/api/v1/users")
      .send({
        email: "tentative.superadmin@users-create-platform-org.test",
        password: "MotDePasseReel123!",
        firstName: "Tentative",
        lastName: "Superadmin",
        roleId: superAdminRoleId,
      })
      .expect(400);
  });

  it("un demandeur hôtel-scopé ne peut créer un utilisateur que pour son propre hôtel", async () => {
    const org = await createOrganizationWithRole(prisma, "users-create-scope-org", ["users.create"]);
    const hotelA = await createHotelUser(prisma, org.organizationId, org.roleId, "users-create-scope-a");
    const hotelB = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "Users Create Scope B", slug: "users-create-scope-b" },
    });
    const role = await createRole(prisma, org.organizationId, "TEST_SCOPE_ROLE", ["reservations.view"]);

    const tokenA = await loginAndGetToken(app, hotelA.email, hotelA.password);
    await authed(app, tokenA)
      .post("/api/v1/users")
      .send({
        email: "hors-perimetre@users-create-scope-org.test",
        password: "MotDePasseReel123!",
        firstName: "Hors",
        lastName: "Perimetre",
        hotelId: hotelB.id,
        roleId: role,
      })
      .expect(403);
  });
});

describe("Utilisateurs — POST/DELETE /users/:id/hotel-memberships", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminRoleId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);
    superAdminRoleId = await ensureSuperAdminRole(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("ajoute une 2e HotelMembership à un utilisateur existant (profil multi-hôtel), puis la révoque", async () => {
    // SUPER_ADMIN org-wide : seul profil qui peut cibler explicitement un hotelId de son choix.
    const org = await createOrganizationWithRole(prisma, "users-membership-org", []);
    const hotelA = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "Users Membership A", slug: "users-membership-a" },
    });
    const hotelB = await prisma.hotel.create({
      data: { organizationId: org.organizationId, name: "Users Membership B", slug: "users-membership-b" },
    });
    const roleA = await createRole(prisma, org.organizationId, "TEST_MEMBERSHIP_A", ["reservations.view"]);
    const roleB = await createRole(prisma, org.organizationId, "TEST_MEMBERSHIP_B", ["finance-revenues.view"]);

    const superAdminTenant = await createTenant(prisma, "users-membership-superadmin-org");
    const superAdminUser = await prisma.user.findUniqueOrThrow({ where: { email: superAdminTenant.email } });
    await prisma.userRole.deleteMany({ where: { userId: superAdminUser.id } });
    await prisma.userRole.create({ data: { userId: superAdminUser.id, roleId: superAdminRoleId } });
    await prisma.user.update({ where: { id: superAdminUser.id }, data: { organizationId: org.organizationId, hotelId: null } });
    const superAdminToken = await loginAndGetToken(app, superAdminTenant.email, superAdminTenant.password);
    const superAdminClient = authed(app, superAdminToken);

    const created = await superAdminClient
      .post("/api/v1/users")
      .send({
        email: "multi.hotel@users-membership-org.test",
        password: "MotDePasseReel123!",
        firstName: "Multi",
        lastName: "Hotel",
        hotelId: hotelA.id,
        roleId: roleA,
      })
      .expect(201);
    const userId = created.body.id as string;

    const withSecondMembership = await superAdminClient
      .post(`/api/v1/users/${userId}/hotel-memberships`)
      .send({ hotelId: hotelB.id, roleId: roleB })
      .expect(201);
    expect(withSecondMembership.body.hotelMemberships).toHaveLength(2);

    let token = await loginAndGetToken(app, "multi.hotel@users-membership-org.test", "MotDePasseReel123!");
    await authed(app, token).get("/api/v1/reservations").expect(200);

    const switchResponse = await authed(app, token).post("/api/v1/auth/switch-hotel").send({ hotelId: hotelB.id }).expect(200);
    token = switchResponse.body.accessToken;
    await authed(app, token).get("/api/v1/revenues").expect(200);

    await superAdminClient.delete(`/api/v1/users/${userId}/hotel-memberships/${hotelB.id}`).expect(200);

    // Une nouvelle session de cet utilisateur ne peut plus basculer vers l'hôtel B (membership révoquée).
    const freshToken = await loginAndGetToken(app, "multi.hotel@users-membership-org.test", "MotDePasseReel123!");
    await authed(app, freshToken).post("/api/v1/auth/switch-hotel").send({ hotelId: hotelB.id }).expect(403);
  });
});
