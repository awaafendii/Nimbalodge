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
  { key: "organizations.view", description: "Voir l'organisation" },
  { key: "hotels.view", description: "Voir les hôtels" },
  { key: "hotels.create", description: "Créer un hôtel" },
  { key: "hotels.update", description: "Modifier un hôtel" },
  { key: "departments.view", description: "Voir les départements" },
  { key: "departments.create", description: "Créer un département" },
  { key: "departments.update", description: "Modifier un département" },
  { key: "activities.view", description: "Voir les activités" },
  { key: "activities.create", description: "Créer une activité" },
  { key: "activities.update", description: "Modifier une activité" },
  { key: "cost-centers.view", description: "Voir les centres de coûts" },
  { key: "cost-centers.create", description: "Créer un centre de coûts" },
  { key: "cost-centers.update", description: "Modifier un centre de coûts" },
  // Phase 5 — format "finance.<ressource>.<action>" (exemple explicite du brief §30), distinct du
  // format plat utilisé ci-dessus (Phase 3-4 n'avait pas d'exemple contraire).
  { key: "finance.category.view", description: "Voir les catégories financières" },
  { key: "finance.category.create", description: "Créer une catégorie financière" },
  { key: "finance.category.update", description: "Modifier une catégorie financière" },
  { key: "finance.cash-account.view", description: "Voir les caisses" },
  { key: "finance.cash-account.create", description: "Créer une caisse" },
  { key: "finance.cash-account.update", description: "Modifier une caisse / saisir une opération" },
  { key: "finance.bank-account.view", description: "Voir les comptes bancaires" },
  { key: "finance.bank-account.create", description: "Créer un compte bancaire" },
  { key: "finance.bank-account.update", description: "Modifier un compte bancaire / saisir une opération" },
  { key: "finance.revenue.view", description: "Voir les recettes" },
  { key: "finance.revenue.create", description: "Créer une recette" },
  { key: "finance.expense.view", description: "Voir les dépenses" },
  { key: "finance.expense.create", description: "Créer une dépense" },
  { key: "finance.expense.update", description: "Modifier une dépense en brouillon" },
  { key: "finance.expense.submit", description: "Soumettre une dépense" },
  { key: "finance.expense.approve", description: "Approuver ou rejeter une dépense" },
  { key: "finance.expense.pay", description: "Marquer une dépense comme payée" },
  { key: "finance.expense.book", description: "Comptabiliser une dépense" },
  { key: "finance.budget.view", description: "Voir les budgets" },
  { key: "finance.budget.create", description: "Créer un budget" },
  { key: "finance.budget.update", description: "Modifier un budget / ajouter une ligne" },
  { key: "finance.summary.view", description: "Voir le résumé financier" },
  // Phase 6
  { key: "finance.invoice.view", description: "Voir les factures" },
  { key: "finance.invoice.create", description: "Créer une facture" },
  { key: "finance.invoice.update", description: "Modifier une facture en brouillon" },
  { key: "finance.invoice.issue", description: "Émettre une facture" },
  { key: "finance.invoice.cancel", description: "Annuler une facture" },
  { key: "finance.payment.view", description: "Voir les paiements" },
  { key: "finance.payment.create", description: "Enregistrer un paiement" },
  { key: "finance.credit-note.view", description: "Voir les avoirs" },
  { key: "finance.credit-note.create", description: "Émettre un avoir" },
  // Phase 7 — format plat "resource.action", cohérent Phase 3-4 (domaine non-finance).
  { key: "room-types.view", description: "Voir les types de chambres" },
  { key: "room-types.create", description: "Créer un type de chambre" },
  { key: "room-types.update", description: "Modifier un type de chambre" },
  { key: "rooms.view", description: "Voir les chambres" },
  { key: "rooms.create", description: "Créer une chambre" },
  { key: "rooms.update", description: "Modifier une chambre" },
  { key: "guests.view", description: "Voir les clients" },
  { key: "guests.create", description: "Créer un client" },
  { key: "guests.update", description: "Modifier un client" },
  { key: "reservations.view", description: "Voir les réservations" },
  { key: "reservations.create", description: "Créer une réservation" },
  { key: "reservations.update", description: "Modifier une réservation en attente" },
  { key: "reservations.confirm", description: "Confirmer une réservation" },
  { key: "reservations.check-in", description: "Enregistrer l'arrivée d'un client" },
  { key: "reservations.check-out", description: "Enregistrer le départ d'un client" },
  { key: "reservations.cancel", description: "Annuler une réservation" },
  { key: "reservations.no-show", description: "Marquer une réservation comme non présentée" },
  // Phase 8 — format plat "resource.action", cohérent Phase 7.
  { key: "employees.view", description: "Voir les employés" },
  { key: "employees.create", description: "Créer un employé" },
  { key: "employees.update", description: "Modifier un employé" },
  { key: "work-schedules.view", description: "Voir le planning" },
  { key: "work-schedules.create", description: "Créer un créneau de planning" },
  { key: "work-schedules.update", description: "Modifier un créneau de planning" },
  { key: "attendance.view", description: "Voir les présences" },
  { key: "attendance.create", description: "Pointer une arrivée" },
  { key: "attendance.clock-out", description: "Pointer un départ" },
  { key: "leave-requests.view", description: "Voir les demandes de congé" },
  { key: "leave-requests.create", description: "Créer une demande de congé" },
  { key: "leave-requests.update", description: "Modifier une demande de congé en attente" },
  { key: "leave-requests.approve", description: "Approuver une demande de congé" },
  { key: "leave-requests.reject", description: "Rejeter une demande de congé" },
  { key: "leave-requests.cancel", description: "Annuler une demande de congé" },
  { key: "payslips.view", description: "Voir les bulletins de paie" },
  { key: "payslips.create", description: "Créer un bulletin de paie" },
  { key: "payslips.update", description: "Modifier un bulletin de paie en brouillon" },
  { key: "payslips.finalize", description: "Finaliser un bulletin de paie" },
  { key: "payslips.mark-paid", description: "Marquer un bulletin de paie comme payé" },
  // Phase 9 — format plat "resource.action", cohérent Phase 7-8. "Facture fournisseur"/"paiement"
  // n'ont pas de clés dédiées : ils réutilisent finance.expense.* (Expense.supplierId/
  // purchaseOrderId, additifs).
  { key: "suppliers.view", description: "Voir les fournisseurs" },
  { key: "suppliers.create", description: "Créer un fournisseur" },
  { key: "suppliers.update", description: "Modifier un fournisseur" },
  { key: "purchase-requests.view", description: "Voir les demandes d'achat" },
  { key: "purchase-requests.create", description: "Créer une demande d'achat" },
  { key: "purchase-requests.update", description: "Modifier une demande d'achat en attente" },
  { key: "purchase-requests.approve", description: "Approuver une demande d'achat" },
  { key: "purchase-requests.reject", description: "Rejeter une demande d'achat" },
  { key: "purchase-requests.cancel", description: "Annuler une demande d'achat" },
  { key: "purchase-orders.view", description: "Voir les commandes d'achat" },
  { key: "purchase-orders.create", description: "Créer une commande d'achat" },
  { key: "purchase-orders.update", description: "Modifier une commande d'achat en brouillon" },
  { key: "purchase-orders.send", description: "Envoyer une commande d'achat au fournisseur" },
  { key: "purchase-orders.cancel", description: "Annuler une commande d'achat" },
  { key: "goods-receipts.view", description: "Voir les réceptions" },
  { key: "goods-receipts.create", description: "Enregistrer une réception" },
  // Phase 10 — format plat "resource.action", cohérent Phase 7-9.
  { key: "housekeeping-tasks.view", description: "Voir les tâches de ménage" },
  { key: "housekeeping-tasks.create", description: "Signaler une chambre à nettoyer" },
  { key: "housekeeping-tasks.clean", description: "Marquer une chambre comme nettoyée" },
  { key: "housekeeping-tasks.inspect", description: "Marquer une chambre comme inspectée" },
  { key: "assets.view", description: "Voir les actifs" },
  { key: "assets.create", description: "Créer un actif" },
  { key: "assets.update", description: "Modifier un actif" },
  { key: "maintenance-requests.view", description: "Voir les demandes de maintenance" },
  { key: "maintenance-requests.create", description: "Créer une demande de maintenance" },
  { key: "maintenance-requests.update", description: "Modifier une demande de maintenance en attente" },
  { key: "maintenance-requests.approve", description: "Approuver une demande de maintenance" },
  { key: "maintenance-requests.reject", description: "Rejeter une demande de maintenance" },
  { key: "maintenance-requests.cancel", description: "Annuler une demande de maintenance" },
  { key: "maintenance-interventions.view", description: "Voir les interventions de maintenance" },
  { key: "maintenance-interventions.create", description: "Planifier une intervention de maintenance" },
  { key: "maintenance-interventions.update", description: "Modifier une intervention planifiée" },
  { key: "maintenance-interventions.start", description: "Démarrer une intervention de maintenance" },
  { key: "maintenance-interventions.complete", description: "Terminer une intervention de maintenance" },
  { key: "maintenance-interventions.cancel", description: "Annuler une intervention de maintenance" },
  // Phase 11 — moteur de rapports (§54). Une seule clé cette phase (un seul rapport, "financial") ;
  // format `resource.action` imbriqué façon finance.*, le rapport reste finance-adjacent.
  { key: "reports.financial.view", description: "Voir/exporter le rapport financier" },
  // Phase 12 — notifications (§35) + audit trail (§37). `finance.budget.check-overspend` en format
  // imbriqué (cohérent finance.*, Phase 5) ; le reste en format plat (cohérent Phase 7-10).
  { key: "notifications.view", description: "Voir ses notifications" },
  { key: "notifications.mark-read", description: "Marquer ses notifications comme lues" },
  { key: "audit-logs.view", description: "Voir le journal d'audit" },
  { key: "finance.budget.check-overspend", description: "Vérifier les dépassements budgétaires et générer des alertes" },
  // Phase 13 — format plat "resource.action", cohérent Phase 7-10.
  { key: "warehouses.view", description: "Voir les entrepôts" },
  { key: "warehouses.create", description: "Créer un entrepôt" },
  { key: "warehouses.update", description: "Modifier un entrepôt" },
  { key: "products.view", description: "Voir les produits et leur stock" },
  { key: "products.create", description: "Créer un produit" },
  { key: "products.update", description: "Modifier un produit" },
  { key: "products.check-low-stock", description: "Vérifier les seuils de stock minimum et générer des alertes" },
  { key: "stock-movements.view", description: "Voir les mouvements de stock" },
  { key: "stock-movements.create", description: "Enregistrer une entrée/sortie/consommation/perte de stock" },
  { key: "stock-movements.transfer", description: "Transférer du stock entre entrepôts" },
  { key: "stock-movements.adjustment", description: "Ajuster un stock après inventaire physique" },
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
