import * as bcrypt from "bcryptjs";

import { PrismaService } from "../../src/database/prisma.service";
import { BASE_PERMISSIONS } from "../../../../prisma/permissions-catalog";

// Mot de passe unique pour tous les comptes de test — fixture de test isolée (jamais utilisée en
// dev/prod), autorisée par la directive "no mock/demo data" qui vise le runtime applicatif, pas
// les suites automatisées.
export const TEST_PASSWORD = "TestPassword123!";

let permissionsSeeded: Awaited<ReturnType<typeof seedPermissions>> | null = null;

async function seedPermissions(prisma: PrismaService) {
  return Promise.all(
    BASE_PERMISSIONS.map((permission) =>
      prisma.permission.upsert({ where: { key: permission.key }, update: {}, create: permission })
    )
  );
}

// Le catalogue de permissions est une infrastructure de schéma partagée par toute la base de
// test (comme en dev/prod, voir prisma/permissions-catalog.ts) — seedée une fois, jamais
// dupliquée par tenant. `resetDatabase()` la vide entre fichiers de test ; chaque suite doit donc
// la reseeder explicitement dans son `beforeAll`.
export async function seedPermissionCatalog(prisma: PrismaService) {
  permissionsSeeded = await seedPermissions(prisma);
  return permissionsSeeded;
}

export interface OrganizationFixture {
  organizationId: string;
  roleId: string;
}

// Crée une organisation de test avec un rôle scopé possédant les permissions demandées (toutes
// par défaut) — équivalent du rôle HOTEL_ADMIN du seed de dev, mais isolé par organisation pour
// que chaque suite/test puisse construire des tenants indépendants sans collision.
export async function createOrganizationWithRole(
  prisma: PrismaService,
  slug: string,
  permissionKeys?: string[]
): Promise<OrganizationFixture> {
  const permissions = permissionsSeeded ?? (await seedPermissionCatalog(prisma));
  const organization = await prisma.organization.create({ data: { name: slug, slug } });
  const role = await prisma.role.create({
    data: { name: `TEST_ADMIN_${slug}`, organizationId: organization.id, isSystem: false },
  });
  const granted = permissionKeys
    ? permissions.filter((permission) => permissionKeys.includes(permission.key))
    : permissions;
  await Promise.all(
    granted.map((permission) =>
      prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } })
    )
  );
  return { organizationId: organization.id, roleId: role.id };
}

export interface HotelUserFixture {
  hotelId: string;
  email: string;
  password: string;
}

// Crée un hôtel + un utilisateur rattaché à cet hôtel (hotelId non-nul → scope restreint à cet
// hôtel, comme HOTEL_ADMIN en dev). Réutilisable pour ajouter un 2e hôtel à une organisation déjà
// créée (test d'isolation inter-hôtel) sans dupliquer le rôle.
export async function createHotelUser(
  prisma: PrismaService,
  organizationId: string,
  roleId: string,
  hotelSlug: string
): Promise<HotelUserFixture> {
  const hotel = await prisma.hotel.create({ data: { organizationId, name: hotelSlug, slug: hotelSlug } });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const email = `admin@${hotelSlug}.test`;
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName: "Test", lastName: "Admin", organizationId, hotelId: hotel.id },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId } });
  return { hotelId: hotel.id, email, password: TEST_PASSWORD };
}

export interface TenantFixture extends OrganizationFixture, HotelUserFixture {}

// Cas le plus courant : une organisation + un hôtel + un admin scopé à cet hôtel, en un appel.
export async function createTenant(
  prisma: PrismaService,
  slug: string,
  permissionKeys?: string[]
): Promise<TenantFixture> {
  const org = await createOrganizationWithRole(prisma, slug, permissionKeys);
  const hotelUser = await createHotelUser(prisma, org.organizationId, org.roleId, slug);
  return { ...org, ...hotelUser };
}
