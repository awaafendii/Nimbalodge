import { INestApplication } from "@nestjs/common";

import { createTenant, createUserInHotel, seedPermissionCatalog } from "./support/fixtures";
import { resetDatabase } from "./support/database";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 5 — vérifie assertInDepartmentScope() (apps/api/src/common/utils/assert-in-scope.ts),
// appliqué pour la première fois au module Expenses. Deux utilisateurs du MÊME hôtel : l'un
// affecté au département Restaurant (via UserDepartment), l'autre sans aucune affectation — le
// cas de tous les HOTEL_ADMIN existants aujourd'hui, qui ne doit subir aucune régression.
describe("Scope départemental (assertInDepartmentScope, module Expenses)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string; // sans affectation département — voit tout l'hôtel (comportement inchangé)
  let restaurantManagerToken: string; // affecté au département Restaurant uniquement

  let restaurantExpenseId: string;
  let housekeepingExpenseId: string;
  let restaurantDepartmentId: string;
  let housekeepingDepartmentId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "dept-scope-org");
    adminToken = await loginAndGetToken(app, tenant.email, tenant.password);

    const restaurantManager = await createUserInHotel(
      prisma,
      tenant.organizationId,
      tenant.roleId,
      tenant.hotelId,
      "dept-scope-restaurant-manager"
    );
    restaurantManagerToken = await loginAndGetToken(app, restaurantManager.email, restaurantManager.password);

    const restaurantDept = await authed(app, adminToken)
      .post("/api/v1/departments")
      .send({ name: "Restaurant" })
      .expect(201);
    restaurantDepartmentId = restaurantDept.body.id;

    const housekeepingDept = await authed(app, adminToken)
      .post("/api/v1/departments")
      .send({ name: "Housekeeping" })
      .expect(201);
    housekeepingDepartmentId = housekeepingDept.body.id;

    const restaurantManagerId = (
      await prisma.user.findUniqueOrThrow({ where: { email: restaurantManager.email } })
    ).id;
    await authed(app, adminToken)
      .post(`/api/v1/departments/${restaurantDepartmentId}/users/${restaurantManagerId}`)
      .expect(201);

    const category = await authed(app, adminToken)
      .post("/api/v1/financial-categories")
      .send({ name: "Achats généraux", type: "EXPENSE" })
      .expect(201);
    const categoryId = category.body.id;

    const restaurantExpense = await authed(app, adminToken)
      .post("/api/v1/expenses")
      .send({ categoryId, amount: 50000, paymentMethod: "CASH", departmentId: restaurantDepartmentId })
      .expect(201);
    restaurantExpenseId = restaurantExpense.body.id;

    const housekeepingExpense = await authed(app, adminToken)
      .post("/api/v1/expenses")
      .send({ categoryId, amount: 30000, paymentMethod: "CASH", departmentId: housekeepingDepartmentId })
      .expect(201);
    housekeepingExpenseId = housekeepingExpense.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("un admin sans affectation département voit toutes les dépenses de l'hôtel (pas de régression)", async () => {
    const response = await authed(app, adminToken).get("/api/v1/expenses").expect(200);
    const ids = response.body.map((expense: { id: string }) => expense.id);
    expect(ids).toContain(restaurantExpenseId);
    expect(ids).toContain(housekeepingExpenseId);
  });

  it("un responsable Restaurant ne voit que les dépenses de son département dans la liste", async () => {
    const response = await authed(app, restaurantManagerToken).get("/api/v1/expenses").expect(200);
    const ids = response.body.map((expense: { id: string }) => expense.id);
    expect(ids).toContain(restaurantExpenseId);
    expect(ids).not.toContain(housekeepingExpenseId);
  });

  it("un responsable Restaurant accède à une dépense de son département", async () => {
    await authed(app, restaurantManagerToken).get(`/api/v1/expenses/${restaurantExpenseId}`).expect(200);
  });

  it("un responsable Restaurant reçoit 403 sur une dépense d'un autre département du même hôtel", async () => {
    const response = await authed(app, restaurantManagerToken)
      .get(`/api/v1/expenses/${housekeepingExpenseId}`)
      .expect(403);
    expect(response.body.message).toContain("département");
  });

  it("un responsable Restaurant ne peut pas créer une dépense pour un autre département", async () => {
    const category = await authed(app, adminToken)
      .post("/api/v1/financial-categories")
      .send({ name: "Fournitures", type: "EXPENSE" })
      .expect(201);

    await authed(app, restaurantManagerToken)
      .post("/api/v1/expenses")
      .send({ categoryId: category.body.id, amount: 10000, paymentMethod: "CASH", departmentId: housekeepingDepartmentId })
      .expect(403);
  });

  it("un responsable Restaurant peut créer une dépense pour son propre département", async () => {
    const category = await authed(app, adminToken)
      .post("/api/v1/financial-categories")
      .send({ name: "Ingrédients", type: "EXPENSE" })
      .expect(201);

    await authed(app, restaurantManagerToken)
      .post("/api/v1/expenses")
      .send({ categoryId: category.body.id, amount: 15000, paymentMethod: "CASH", departmentId: restaurantDepartmentId })
      .expect(201);
  });
});
