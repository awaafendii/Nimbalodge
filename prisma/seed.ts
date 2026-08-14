// Seed de développement local — idempotent (upsert), jamais exécuté en production automatiquement.
// Identifiants créés ici documentés dans docs/architecture/phase-3-auth-rbac.md (dev only).
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BASE_PERMISSIONS = [
  { key: "users.view", description: "Voir les utilisateurs" },
  { key: "users.create", description: "Créer un utilisateur" },
  { key: "roles.view", description: "Voir les rôles" },
  { key: "permissions.view", description: "Voir les permissions" },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "nimbalodge-demo" },
    update: {},
    create: { name: "NimbaLodge Demo", slug: "nimbalodge-demo" },
  });

  const hotel = await prisma.hotel.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: "hotel-nimba-conakry" } },
    update: {},
    create: { organizationId: organization.id, name: "Hôtel Nimba Conakry", slug: "hotel-nimba-conakry" },
  });

  const permissions = await Promise.all(
    BASE_PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: {},
        create: permission,
      })
    )
  );

  // Prisma refuse `null` dans le where composé d'un upsert (`organizationId_name`) même si la
  // contrainte DB l'autorise (Postgres traite chaque NULL comme distinct) — pattern
  // findFirst + create manuel à la place, pour ce rôle global uniquement.
  let superAdminRole = await prisma.role.findFirst({
    where: { organizationId: null, name: "SUPER_ADMIN" },
  });
  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        name: "SUPER_ADMIN",
        description: "Accès complet, non rattaché à un hôtel spécifique",
        organizationId: null,
        isSystem: true,
      },
    });
  }

  const hotelAdminRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "HOTEL_ADMIN" } },
    update: {},
    create: {
      name: "HOTEL_ADMIN",
      description: "Administrateur d'un hôtel — accès limité à son propre hôtel",
      organizationId: organization.id,
      isSystem: true,
    },
  });

  // SUPER_ADMIN reçoit toutes les permissions de base ; HOTEL_ADMIN un sous-ensemble
  // (pas roles.view/permissions.view) — pour rendre visible la différenciation des permissions.
  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: permission.id },
      })
    )
  );

  const hotelAdminPermissionKeys = new Set(["users.view", "users.create"]);
  await Promise.all(
    permissions
      .filter((permission) => hotelAdminPermissionKeys.has(permission.key))
      .map((permission) =>
        prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: hotelAdminRole.id, permissionId: permission.id } },
          update: {},
          create: { roleId: hotelAdminRole.id, permissionId: permission.id },
        })
      )
  );

  const superAdminPasswordHash = await bcrypt.hash("SuperAdmin123!", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@nimbalodge.dev" },
    update: {},
    create: {
      email: "superadmin@nimbalodge.dev",
      passwordHash: superAdminPasswordHash,
      firstName: "Super",
      lastName: "Admin",
      organizationId: organization.id,
      hotelId: null,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: superAdminRole.id },
  });

  const hotelAdminPasswordHash = await bcrypt.hash("HotelAdmin123!", 12);
  const hotelAdmin = await prisma.user.upsert({
    where: { email: "hoteladmin@nimbalodge.dev" },
    update: {},
    create: {
      email: "hoteladmin@nimbalodge.dev",
      passwordHash: hotelAdminPasswordHash,
      firstName: "Hotel",
      lastName: "Admin",
      organizationId: organization.id,
      hotelId: hotel.id,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: hotelAdmin.id, roleId: hotelAdminRole.id } },
    update: {},
    create: { userId: hotelAdmin.id, roleId: hotelAdminRole.id },
  });

  console.log("Seed terminé :");
  console.log(`  Organization: ${organization.name} (${organization.id})`);
  console.log(`  Hotel: ${hotel.name} (${hotel.id})`);
  console.log(`  Users: ${superAdmin.email} (SUPER_ADMIN), ${hotelAdmin.email} (HOTEL_ADMIN)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
