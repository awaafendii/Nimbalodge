// Bootstrap de production — SEUL script destiné à tourner contre une vraie base de production.
// Ne crée AUCUNE donnée de démonstration : ni Hotel, ni Department, ni compte HOTEL_ADMIN, ni
// aucun enregistrement métier (Revenue/Expense/Reservation/...). Conformément à la directive
// produit ("la base de production doit démarrer sans données métier — les données sont créées
// exclusivement par les utilisateurs via les workflows réels"), ce script crée uniquement :
//
//   1. Le catalogue de permissions + le rôle SUPER_ADMIN global (infrastructure RBAC, au même
//      titre qu'une migration — pas une donnée métier), toujours ré-exécuté (idempotent, upsert).
//   2. Une Organization + UN compte SUPER_ADMIN réel, à partir de variables d'environnement
//      fournies par l'opérateur du déploiement — jamais de valeur en dur. Ignoré silencieusement
//      si un utilisateur avec cet email existe déjà (safe à ré-exécuter à chaque déploiement).
//
// L'administrateur ainsi créé configure ensuite lui-même son premier hôtel (et tout le reste —
// départements, catégories financières, caisses...) via l'application réelle : "aucun département/
// catégorie/caisse/compte bancaire/activité ne doit être imposé".
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

import { BASE_PERMISSIONS } from "./permissions-catalog";

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Variable d'environnement ${name} manquante — requise pour le bootstrap de production (voir docs/deployment/render.md).`
    );
  }
  return value;
}

async function main() {
  const adminEmail = requireEnv("BOOTSTRAP_ADMIN_EMAIL");
  const adminPassword = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const adminFirstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME ?? "Admin";
  const adminLastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME ?? "Principal";
  const orgName = requireEnv("BOOTSTRAP_ORG_NAME");

  if (adminPassword.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD doit contenir au moins 12 caractères.");
  }

  const permissions = await Promise.all(
    BASE_PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: {},
        create: permission,
      })
    )
  );

  // organizationId null = rôle système global (voir schema.prisma, model Role) — même pattern que
  // seed.ts : upsert impossible sur une contrainte composée avec null, findFirst + create manuel.
  let superAdminRole = await prisma.role.findFirst({ where: { organizationId: null, name: "SUPER_ADMIN" } });
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

  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: permission.id },
      })
    )
  );

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    console.log(`Bootstrap : le compte ${adminEmail} existe déjà — aucune donnée de compte créée (permissions à jour).`);
    return;
  }

  const slug = orgName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques (accents) après décomposition Unicode
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const organization = await prisma.organization.upsert({
    where: { slug },
    update: {},
    create: { name: orgName, slug },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      firstName: adminFirstName,
      lastName: adminLastName,
      organizationId: organization.id,
      hotelId: null,
    },
  });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: superAdminRole.id } });

  console.log("Bootstrap de production terminé :");
  console.log(`  Organization : ${organization.name} (${organization.id})`);
  console.log(`  Compte SUPER_ADMIN : ${admin.email}`);
  console.log("  Aucun hôtel/département/catégorie créé — à configurer depuis l'application.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
