// Seed de développement local — idempotent (upsert), jamais exécuté en production automatiquement.
// Identifiants créés ici documentés dans docs/architecture/phase-3-auth-rbac.md (dev only). Pour un
// déploiement réel, voir prisma/bootstrap-production.ts (aucune donnée de démo, compte admin réel
// fourni par variables d'environnement) — docs/deployment/render.md.
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

import { BASE_PERMISSIONS } from "./permissions-catalog";

const prisma = new PrismaClient();

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

  // HOTEL_ADMIN reçoit tout sauf hotels.create/hotels.update : gérer le portefeuille d'hôtels
  // d'une organisation est une opération org-wide, pas celle d'un admin scopé à un seul hôtel.
  const hotelAdminPermissionKeys = new Set([
    "users.view",
    "users.create",
    "organizations.view",
    "hotels.view",
    "departments.view",
    "departments.create",
    "departments.update",
    "activities.view",
    "activities.create",
    "activities.update",
    "cost-centers.view",
    "cost-centers.create",
    "cost-centers.update",
    // Finance — tout sauf finance.expense.book : comptabiliser relève d'un contrôle financier
    // org-level, même logique que l'exclusion hotels.create/update ci-dessus. Sert aussi de cas
    // de test 403 sans inventer un 3e rôle démo.
    "finance.category.view",
    "finance.category.create",
    "finance.category.update",
    "finance.cash-account.view",
    "finance.cash-account.create",
    "finance.cash-account.update",
    "finance.bank-account.view",
    "finance.bank-account.create",
    "finance.bank-account.update",
    "finance.revenue.view",
    "finance.revenue.create",
    "finance.expense.view",
    "finance.expense.create",
    "finance.expense.update",
    "finance.expense.submit",
    "finance.expense.approve",
    "finance.expense.pay",
    "finance.budget.view",
    "finance.budget.create",
    "finance.budget.update",
    "finance.summary.view",
    // Phase 6 — HOTEL_ADMIN reçoit toutes les permissions de facturation : contrairement à
    // finance.expense.book, rien ici n'a d'équivalent de contrôle org-level, facturer est une
    // activité hôtelière quotidienne.
    "finance.invoice.view",
    "finance.invoice.create",
    "finance.invoice.update",
    "finance.invoice.issue",
    "finance.invoice.cancel",
    "finance.payment.view",
    "finance.payment.create",
    "finance.credit-note.view",
    "finance.credit-note.create",
    // Phase 7 — HOTEL_ADMIN reçoit toutes les permissions réservations/chambres/clients : gestion
    // quotidienne hôtelière, aucun équivalent de contrôle org-level identifié (même raisonnement
    // que la facturation Phase 6).
    "room-types.view",
    "room-types.create",
    "room-types.update",
    "rooms.view",
    "rooms.create",
    "rooms.update",
    "guests.view",
    "guests.create",
    "guests.update",
    "reservations.view",
    "reservations.create",
    "reservations.update",
    "reservations.confirm",
    "reservations.check-in",
    "reservations.check-out",
    "reservations.cancel",
    "reservations.no-show",
    // Phase 8 — HOTEL_ADMIN reçoit tout, y compris payslips.mark-paid : gestion quotidienne
    // hôtelière, même raisonnement que la facturation Phase 6/7 (aucun équivalent de contrôle
    // org-level identifié, contrairement à finance.expense.book).
    "employees.view",
    "employees.create",
    "employees.update",
    "work-schedules.view",
    "work-schedules.create",
    "work-schedules.update",
    "attendance.view",
    "attendance.create",
    "attendance.clock-out",
    "leave-requests.view",
    "leave-requests.create",
    "leave-requests.update",
    "leave-requests.approve",
    "leave-requests.reject",
    "leave-requests.cancel",
    "payslips.view",
    "payslips.create",
    "payslips.update",
    "payslips.finalize",
    "payslips.mark-paid",
    // Phase 9 — HOTEL_ADMIN reçoit tout, même raisonnement que la facturation/RH (Phase 6-8) :
    // aucun équivalent de contrôle org-level identifié pour les achats, contrairement à
    // finance.expense.book.
    "suppliers.view",
    "suppliers.create",
    "suppliers.update",
    "purchase-requests.view",
    "purchase-requests.create",
    "purchase-requests.update",
    "purchase-requests.approve",
    "purchase-requests.reject",
    "purchase-requests.cancel",
    "purchase-orders.view",
    "purchase-orders.create",
    "purchase-orders.update",
    "purchase-orders.send",
    "purchase-orders.cancel",
    "goods-receipts.view",
    "goods-receipts.create",
    // Phase 10 — HOTEL_ADMIN reçoit tout, même raisonnement que Phase 7-9 : aucun équivalent de
    // contrôle org-level identifié pour le ménage/la maintenance.
    "housekeeping-tasks.view",
    "housekeeping-tasks.create",
    "housekeeping-tasks.clean",
    "housekeeping-tasks.inspect",
    "assets.view",
    "assets.create",
    "assets.update",
    "maintenance-requests.view",
    "maintenance-requests.create",
    "maintenance-requests.update",
    "maintenance-requests.approve",
    "maintenance-requests.reject",
    "maintenance-requests.cancel",
    "maintenance-interventions.view",
    "maintenance-interventions.create",
    "maintenance-interventions.update",
    "maintenance-interventions.start",
    "maintenance-interventions.complete",
    "maintenance-interventions.cancel",
    // Phase 11 — HOTEL_ADMIN reçoit le rapport financier, même raisonnement que finance.summary.view
    // (Phase 5) : lecture, aucun contrôle org-level à exclure.
    "reports.financial.view",
    // Phase 12 — HOTEL_ADMIN reçoit tout : notifications/audit sont scopés par utilisateur/hôtel
    // (pas de contrôle org-level à exclure), et check-overspend est une simple lecture déclenchant
    // des notifications, pas un mouvement d'argent (contrairement à finance.expense.book).
    "notifications.view",
    "notifications.mark-read",
    "audit-logs.view",
    "finance.budget.check-overspend",
    // Phase 13 — HOTEL_ADMIN reçoit tout, même raisonnement que Phase 7-10 : aucun contrôle
    // org-level identifié pour l'inventaire.
    "warehouses.view",
    "warehouses.create",
    "warehouses.update",
    "products.view",
    "products.create",
    "products.update",
    "products.check-low-stock",
    "stock-movements.view",
    "stock-movements.create",
    "stock-movements.transfer",
    "stock-movements.adjustment",
  ]);
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
