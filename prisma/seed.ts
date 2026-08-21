// Seed de développement local — idempotent (upsert), jamais exécuté en production automatiquement.
// Identifiants créés ici documentés dans docs/architecture/phase-3-auth-rbac.md (dev only). Pour un
// déploiement réel, voir prisma/bootstrap-production.ts (aucune donnée de démo, compte admin réel
// fourni par variables d'environnement) — docs/deployment/render.md.
import { PrismaClient, type Permission } from "@prisma/client";
import * as bcrypt from "bcryptjs";

import { BASE_PERMISSIONS } from "./permissions-catalog";

const prisma = new PrismaClient();

// RBAC multi-hôtel (audit RBAC multi-hôtel) — 8 profils métier officiels, chacun un rôle
// org-scopé attribué exclusivement via HotelMembership (jamais UserRole, réservé aux rôles
// plateforme). Helper partagé pour éviter de répéter le trio upsert-rôle / filtrer-permissions /
// upsert-RolePermission sept fois.
async function upsertBusinessRole(
  organizationId: string,
  name: string,
  description: string,
  permissionKeys: Set<string>,
  allPermissions: Permission[]
) {
  const role = await prisma.role.upsert({
    where: { organizationId_name: { organizationId, name } },
    update: {},
    create: { name, description, organizationId, isSystem: true },
  });
  const granted = allPermissions.filter((permission) => permissionKeys.has(permission.key));
  await Promise.all(
    granted.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      })
    )
  );
  return role;
}

async function upsertTestUser(
  organizationId: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  defaultHotelId: string
) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, firstName, lastName, organizationId, hotelId: defaultHotelId },
  });
}

async function upsertMembership(userId: string, hotelId: string, roleId: string) {
  return prisma.hotelMembership.upsert({
    where: { userId_hotelId: { userId, hotelId } },
    update: { roleId, status: "ACTIVE" },
    create: { userId, hotelId, roleId },
  });
}

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

  // HOTEL_ADMIN — CONSERVÉ tel quel (schéma + RolePermission), mais plus attribué à personne par
  // ce seed depuis la migration RBAC multi-hôtel (audit RBAC multi-hôtel) : remplacé par
  // DIRECTEUR_HOTEL, attribué via HotelMembership plutôt que UserRole. Ne pas supprimer ce rôle
  // tant que toutes les références (code/seeds/tests/doc) n'ont pas été nettoyées — voir
  // docs/architecture (à documenter en fin de migration).
  const hotelAdminRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "HOTEL_ADMIN" } },
    update: {},
    create: {
      name: "HOTEL_ADMIN",
      description: "[Ancien rôle, retiré — voir DIRECTEUR_HOTEL] Administrateur d'un hôtel",
      organizationId: organization.id,
      isSystem: true,
    },
  });

  // DIRECTEUR_HOTEL — rôle métier officiel qui remplace HOTEL_ADMIN (audit RBAC multi-hôtel,
  // mapping confirmé : mêmes permissions, aucun accès organisationnel/Boss ajouté ou retiré).
  // Attribué via HotelMembership, jamais via UserRole (voir schema.prisma, commentaire sur Role).
  const directeurHotelRole = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "DIRECTEUR_HOTEL" } },
    update: {},
    create: {
      name: "DIRECTEUR_HOTEL",
      description: "Supervision complète d'un établissement — pas de gestion organisationnelle (hôtels/rôles)",
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

  // Ensemble partagé HOTEL_ADMIN (conservé, plus attribué) / DIRECTEUR_HOTEL (rôle officiel) :
  // tout sauf hotels.create/hotels.update — gérer le portefeuille d'hôtels d'une organisation est
  // une opération org-wide (Boss), pas celle d'un rôle scopé à un seul hôtel. Mapping confirmé
  // identique lors de la migration RBAC multi-hôtel initiale (aucune permission ajoutée ni
  // retirée) ; roles.view ajouté ensuite (audit RBAC multi-hôtel, correctif création
  // d'utilisateurs) — sans elle, DIRECTEUR_HOTEL avait users.create mais ne pouvait pas lister les
  // rôles à proposer lors de la création d'un vrai membre d'équipe (GET /roles). L'exclusion de
  // roles.view/permissions.view était une démonstration délibérée de différenciation Phase 3 (voir
  // commentaire ci-dessus sur SUPER_ADMIN), pas une exigence produit — elle cède le pas dès qu'un
  // vrai usage (créer un utilisateur) en dépend.
  const hotelAdminPermissionKeys = new Set([
    "users.view",
    "users.create",
    "roles.view",
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
    // Finance — tout sauf finance-expenses.book : comptabiliser relève d'un contrôle financier
    // org-level, même logique que l'exclusion hotels.create/update ci-dessus. Sert aussi de cas
    // de test 403 sans inventer un 3e rôle démo.
    "finance-categories.view",
    "finance-categories.create",
    "finance-categories.update",
    "finance-cash-accounts.view",
    "finance-cash-accounts.create",
    "finance-cash-accounts.update",
    "finance-bank-accounts.view",
    "finance-bank-accounts.create",
    "finance-bank-accounts.update",
    "finance-revenues.view",
    "finance-revenues.create",
    "finance-expenses.view",
    "finance-expenses.create",
    "finance-expenses.update",
    "finance-expenses.submit",
    "finance-expenses.approve",
    "finance-expenses.pay",
    "finance-budgets.view",
    "finance-budgets.create",
    "finance-budgets.update",
    "finance-summary.view",
    // Phase 6 — HOTEL_ADMIN reçoit toutes les permissions de facturation : contrairement à
    // finance-expenses.book, rien ici n'a d'équivalent de contrôle org-level, facturer est une
    // activité hôtelière quotidienne.
    "finance-invoices.view",
    "finance-invoices.create",
    "finance-invoices.update",
    "finance-invoices.issue",
    "finance-invoices.cancel",
    "finance-payments.view",
    "finance-payments.create",
    "finance-credit-notes.view",
    "finance-credit-notes.create",
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
    // org-level identifié, contrairement à finance-expenses.book).
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
    // finance-expenses.book.
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
    // Phase 11 — HOTEL_ADMIN reçoit le rapport financier, même raisonnement que finance-summary.view
    // (Phase 5) : lecture, aucun contrôle org-level à exclure.
    "reports.financial.view",
    // Phase 12 — HOTEL_ADMIN reçoit tout : notifications/audit sont scopés par utilisateur/hôtel
    // (pas de contrôle org-level à exclure), et check-overspend est une simple lecture déclenchant
    // des notifications, pas un mouvement d'argent (contrairement à finance-expenses.book).
    "notifications.view",
    "notifications.mark-read",
    "audit-logs.view",
    "finance-budgets.check-overspend",
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
    // Nimba AI — donnée renvoyée par les Tools est scopée à l'hôtel/organisation du demandeur
    // exactement comme le reste (même raisonnement que reports.financial.view/audit-logs.view
    // ci-dessus : lecture scopée, aucun contrôle org-level à exclure). Contrairement à
    // system-monitoring.view (donnée plateforme transverse, réservée SUPER_ADMIN), les insights/
    // anomalies Nimba AI ne concernent que les données de l'hôtel du demandeur.
    "nimba-ai.use",
  ]);
  const hotelAdminPermissions = permissions.filter((permission) => hotelAdminPermissionKeys.has(permission.key));
  await Promise.all([
    ...hotelAdminPermissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: hotelAdminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: hotelAdminRole.id, permissionId: permission.id },
      })
    ),
    ...hotelAdminPermissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: directeurHotelRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: directeurHotelRole.id, permissionId: permission.id },
      })
    ),
  ]);

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

  // hoteladmin@nimbalodge.dev — migré vers DIRECTEUR_HOTEL via HotelMembership (audit RBAC
  // multi-hôtel) : plus de UserRole(HOTEL_ADMIN). `userRole.deleteMany` nettoie une éventuelle
  // ligne héritée d'un seed exécuté avant cette migration (idempotent : no-op sur une base déjà à
  // jour ou fraîchement créée).
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
  await prisma.userRole.deleteMany({ where: { userId: hotelAdmin.id, roleId: hotelAdminRole.id } });
  await prisma.hotelMembership.upsert({
    where: { userId_hotelId: { userId: hotelAdmin.id, hotelId: hotel.id } },
    update: { roleId: directeurHotelRole.id, status: "ACTIVE" },
    create: { userId: hotelAdmin.id, hotelId: hotel.id, roleId: directeurHotelRole.id },
  });

  // ===========================================================================================
  // RBAC multi-hôtel — 7 profils métier restants + hôtels de test (audit RBAC multi-hôtel).
  // Comptes/hôtels EXCLUSIVEMENT dev (jamais dans bootstrap-production.ts). Identifiants exacts
  // fournis par le produit — ne pas les modifier sans le signaler.
  // ===========================================================================================

  const hotelKindia = await prisma.hotel.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: "hotel-nimba-kindia" } },
    update: {},
    create: { organizationId: organization.id, name: "Hôtel Nimba Kindia", slug: "hotel-nimba-kindia" },
  });
  const hotelLabe = await prisma.hotel.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: "hotel-nimba-labe" } },
    update: {},
    create: { organizationId: organization.id, name: "Hôtel Nimba Labé", slug: "hotel-nimba-labe" },
  });

  // BOSS — tout le catalogue SAUF system-monitoring.view (métrique plateforme transverse,
  // réservée SUPER_ADMIN — jamais un rôle métier, même le plus large). L'étendue de son accès
  // réel dépend uniquement de ses HotelMembership, jamais accordée automatiquement (§ décisions
  // validées : pas d'accès à un hôtel sans membership explicite).
  const bossPermissionKeys = new Set(permissions.map((p) => p.key).filter((key) => key !== "system-monitoring.view"));
  const bossRole = await upsertBusinessRole(
    organization.id,
    "BOSS",
    "Propriétaire — accès complet à ses établissements (via HotelMembership), pas de métriques plateforme",
    bossPermissionKeys,
    permissions
  );

  // RESPONSABLE_FINANCIER — domaine Finance complet (§6). finance-expenses.book exclu, même
  // raisonnement que pour HOTEL_ADMIN/DIRECTEUR_HOTEL : comptabiliser reste un contrôle org-level
  // au-dessus du scope hôtel d'un rôle métier (réservé BOSS).
  const financeManagerPermissionKeys = new Set([
    "users.view",
    "hotels.view",
    "departments.view",
    "activities.view",
    "activities.create",
    "activities.update",
    "cost-centers.view",
    "cost-centers.create",
    "cost-centers.update",
    "finance-categories.view",
    "finance-categories.create",
    "finance-categories.update",
    "finance-cash-accounts.view",
    "finance-cash-accounts.create",
    "finance-cash-accounts.update",
    "finance-bank-accounts.view",
    "finance-bank-accounts.create",
    "finance-bank-accounts.update",
    "finance-revenues.view",
    "finance-revenues.create",
    "finance-expenses.view",
    "finance-expenses.create",
    "finance-expenses.update",
    "finance-expenses.submit",
    "finance-expenses.approve",
    "finance-expenses.pay",
    "finance-budgets.view",
    "finance-budgets.create",
    "finance-budgets.update",
    "finance-budgets.check-overspend",
    "finance-summary.view",
    "finance-invoices.view",
    "finance-invoices.create",
    "finance-invoices.update",
    "finance-invoices.issue",
    "finance-invoices.cancel",
    "finance-payments.view",
    "finance-payments.create",
    "finance-credit-notes.view",
    "finance-credit-notes.create",
    "reports.financial.view",
    "notifications.view",
    "notifications.mark-read",
    "nimba-ai.use",
  ]);
  const financeManagerRole = await upsertBusinessRole(
    organization.id,
    "RESPONSABLE_FINANCIER",
    "Gère l'ensemble du domaine Finance de son établissement",
    financeManagerPermissionKeys,
    permissions
  );

  // RESPONSABLE_RH — domaine RH complet (§8). Aucun "Agent RH" : ce rôle couvre tout le domaine.
  const hrManagerPermissionKeys = new Set([
    "users.view",
    "hotels.view",
    "departments.view",
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
    "notifications.view",
    "notifications.mark-read",
    "nimba-ai.use",
  ]);
  const hrManagerRole = await upsertBusinessRole(
    organization.id,
    "RESPONSABLE_RH",
    "Gère l'ensemble du domaine RH de son établissement",
    hrManagerPermissionKeys,
    permissions
  );

  // RECEPTIONNISTE (§10) — Réservations/Clients/Hébergement/Chambres/Check-in/Check-out. Permission
  // financière explicitement définie (pas de Finance complet) : voir/encaisser un paiement pour
  // solder le folio d'un client au départ, voir la facture correspondante — rien de plus
  // (pas de création/émission/annulation de facture, pas de Caisse/Banque/Budget).
  const receptionistPermissionKeys = new Set([
    "users.view",
    "hotels.view",
    "room-types.view",
    "rooms.view",
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
    "finance-invoices.view",
    "finance-payments.view",
    "finance-payments.create",
    "notifications.view",
    "notifications.mark-read",
  ]);
  const receptionistRole = await upsertBusinessRole(
    organization.id,
    "RECEPTIONNISTE",
    "Réservations, clients, hébergement — pas de Finance/Banque/Budget/RH/Paie/Administration",
    receptionistPermissionKeys,
    permissions
  );

  // RESPONSABLE_STOCK (§11) — Stocks + Achats. Aucune permission Finance accordée : aucune action
  // du workflow Achats/Stock actuel ne l'exige (la bascule vers Finance se fait côté Expense, via
  // un rôle Finance distinct) — à revoir si un workflow futur l'exige explicitement.
  const stockManagerPermissionKeys = new Set([
    "users.view",
    "hotels.view",
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
    "notifications.view",
    "notifications.mark-read",
  ]);
  const stockManagerRole = await upsertBusinessRole(
    organization.id,
    "RESPONSABLE_STOCK",
    "Stocks et achats de son établissement — pas de Finance dans son intégralité",
    stockManagerPermissionKeys,
    permissions
  );

  // RESPONSABLE_MAINTENANCE (§12) — Équipements/Interventions/Incidents. Lecture seule sur
  // Produits/Mouvements (vérifier la disponibilité de pièces), jamais de gestion de stock.
  const maintenanceManagerPermissionKeys = new Set([
    "users.view",
    "hotels.view",
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
    "products.view",
    "stock-movements.view",
    "notifications.view",
    "notifications.mark-read",
  ]);
  const maintenanceManagerRole = await upsertBusinessRole(
    organization.id,
    "RESPONSABLE_MAINTENANCE",
    "Équipements et interventions — pas de finances globales ni de RH confidentiel",
    maintenanceManagerPermissionKeys,
    permissions
  );

  // HOUSEKEEPING (§13) — périmètre volontairement minimal (interface mobile/PWA simple et rapide).
  const housekeepingPermissionKeys = new Set([
    "users.view",
    "hotels.view",
    "rooms.view",
    "housekeeping-tasks.view",
    "housekeeping-tasks.create",
    "housekeeping-tasks.clean",
    "housekeeping-tasks.inspect",
    "notifications.view",
    "notifications.mark-read",
  ]);
  const housekeepingRole = await upsertBusinessRole(
    organization.id,
    "HOUSEKEEPING",
    "Statut des chambres et tâches de ménage — accès minimal, optimisé mobile",
    housekeepingPermissionKeys,
    permissions
  );

  // Comptes de test — email/mot de passe exacts fournis par le produit, DEV UNIQUEMENT.
  const boss = await upsertTestUser(organization.id, "boss@nimba-test.com", "NimbaBoss@2026!", "Boss", "Nimba", hotel.id);
  const directeurTest = await upsertTestUser(organization.id, "directeur@nimba-test.com", "NimbaDir@2026!", "Directeur", "Test", hotel.id);
  const financeTest = await upsertTestUser(organization.id, "finance@nimba-test.com", "NimbaFin@2026!", "Finance", "Test", hotel.id);
  const rhTest = await upsertTestUser(organization.id, "rh@nimba-test.com", "NimbaRH@2026!", "RH", "Test", hotel.id);
  const receptionTest = await upsertTestUser(organization.id, "reception@nimba-test.com", "NimbaRec@2026!", "Reception", "Test", hotel.id);
  const stockTest = await upsertTestUser(organization.id, "stock@nimba-test.com", "NimbaStock@2026!", "Stock", "Test", hotel.id);
  const maintenanceTest = await upsertTestUser(organization.id, "maintenance@nimba-test.com", "NimbaMaint@2026!", "Maintenance", "Test", hotel.id);
  const housekeepingTest = await upsertTestUser(organization.id, "housekeeping@nimba-test.com", "NimbaHouse@2026!", "Housekeeping", "Test", hotel.id);

  // Memberships — Boss sur les 3 hôtels (test du HotelSwitcher + isolation), les 7 autres profils
  // scopés à Conakry uniquement (§23 : seul Boss est multi-hôtel dans le jeu de données de test).
  await Promise.all([
    upsertMembership(boss.id, hotel.id, bossRole.id),
    upsertMembership(boss.id, hotelKindia.id, bossRole.id),
    upsertMembership(boss.id, hotelLabe.id, bossRole.id),
    upsertMembership(directeurTest.id, hotel.id, directeurHotelRole.id),
    upsertMembership(financeTest.id, hotel.id, financeManagerRole.id),
    upsertMembership(rhTest.id, hotel.id, hrManagerRole.id),
    upsertMembership(receptionTest.id, hotel.id, receptionistRole.id),
    upsertMembership(stockTest.id, hotel.id, stockManagerRole.id),
    upsertMembership(maintenanceTest.id, hotel.id, maintenanceManagerRole.id),
    upsertMembership(housekeepingTest.id, hotel.id, housekeepingRole.id),
  ]);

  console.log("Seed terminé :");
  console.log(`  Organization: ${organization.name} (${organization.id})`);
  console.log(`  Hotels: ${hotel.name}, ${hotelKindia.name}, ${hotelLabe.name}`);
  console.log(`  Users: ${superAdmin.email} (SUPER_ADMIN), ${hotelAdmin.email} (DIRECTEUR_HOTEL @ ${hotel.name})`);
  console.log(`  Comptes de test (DEV) : ${boss.email} (BOSS @ 3 hôtels), ${directeurTest.email} (DIRECTEUR_HOTEL), ${financeTest.email} (RESPONSABLE_FINANCIER), ${rhTest.email} (RESPONSABLE_RH), ${receptionTest.email} (RECEPTIONNISTE), ${stockTest.email} (RESPONSABLE_STOCK), ${maintenanceTest.email} (RESPONSABLE_MAINTENANCE), ${housekeepingTest.email} (HOUSEKEEPING)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
