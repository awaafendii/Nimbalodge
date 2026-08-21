import { INestApplication } from "@nestjs/common";

import { createTenant, createUserInHotel, seedPermissionCatalog } from "./support/fixtures";
import { resetDatabase } from "./support/database";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Étape 5 — vérifie assertInDepartmentScope() (apps/api/src/common/utils/assert-in-scope.ts),
// appliqué pour la première fois au module Expenses. Deux utilisateurs du MÊME hôtel : l'un
// affecté au département Restaurant (via UserDepartment), l'autre sans aucune affectation — le
// cas des rôles à accès large sur un hôtel (ex. DIRECTEUR_HOTEL), qui ne doit subir aucune régression.
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

// Budget lui-même n'a pas de departmentId (conteneur hôtel partagé — voir le commentaire de
// BudgetsService.findOne) : le scope départemental ne restreint donc pas l'accès au budget, mais
// filtre les BudgetLine renvoyées par findOne/getExecution, et empêche d'ajouter une ligne pour
// un autre département que le sien.
describe("Scope départemental (assertInDepartmentScope, module Budgets)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let restaurantManagerToken: string;

  let budgetId: string;
  let restaurantLineId: string;
  let housekeepingLineId: string;
  let restaurantDepartmentId: string;
  let housekeepingDepartmentId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "dept-scope-budget-org");
    adminToken = await loginAndGetToken(app, tenant.email, tenant.password);

    const restaurantManager = await createUserInHotel(
      prisma,
      tenant.organizationId,
      tenant.roleId,
      tenant.hotelId,
      "dept-scope-budget-restaurant-manager"
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

    const budget = await authed(app, adminToken)
      .post("/api/v1/budgets")
      .send({ name: "Budget 2026", periodType: "ANNUAL", startDate: "2026-01-01", endDate: "2026-12-31" })
      .expect(201);
    budgetId = budget.body.id;

    const restaurantLine = await authed(app, adminToken)
      .post(`/api/v1/budgets/${budgetId}/lines`)
      .send({ type: "EXPENSE", plannedAmount: 500000, departmentId: restaurantDepartmentId })
      .expect(201);
    restaurantLineId = restaurantLine.body.id;

    const housekeepingLine = await authed(app, adminToken)
      .post(`/api/v1/budgets/${budgetId}/lines`)
      .send({ type: "EXPENSE", plannedAmount: 200000, departmentId: housekeepingDepartmentId })
      .expect(201);
    housekeepingLineId = housekeepingLine.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("un admin sans affectation département voit toutes les lignes du budget (pas de régression)", async () => {
    const response = await authed(app, adminToken).get(`/api/v1/budgets/${budgetId}`).expect(200);
    const lineIds = response.body.lines.map((line: { id: string }) => line.id);
    expect(lineIds).toContain(restaurantLineId);
    expect(lineIds).toContain(housekeepingLineId);
  });

  it("le budget reste visible pour un responsable Restaurant (conteneur non départemental)", async () => {
    await authed(app, restaurantManagerToken).get(`/api/v1/budgets/${budgetId}`).expect(200);
  });

  it("un responsable Restaurant ne voit que les lignes de son département dans findOne", async () => {
    const response = await authed(app, restaurantManagerToken).get(`/api/v1/budgets/${budgetId}`).expect(200);
    const lineIds = response.body.lines.map((line: { id: string }) => line.id);
    expect(lineIds).toContain(restaurantLineId);
    expect(lineIds).not.toContain(housekeepingLineId);
  });

  it("un responsable Restaurant ne voit que les lignes de son département dans getExecution", async () => {
    const response = await authed(app, restaurantManagerToken)
      .get(`/api/v1/budgets/${budgetId}/execution`)
      .expect(200);
    const lineIds = response.body.lines.map((line: { lineId: string }) => line.lineId);
    expect(lineIds).toContain(restaurantLineId);
    expect(lineIds).not.toContain(housekeepingLineId);
  });

  it("un responsable Restaurant ne peut pas ajouter une ligne pour un autre département", async () => {
    await authed(app, restaurantManagerToken)
      .post(`/api/v1/budgets/${budgetId}/lines`)
      .send({ type: "EXPENSE", plannedAmount: 10000, departmentId: housekeepingDepartmentId })
      .expect(403);
  });

  it("un responsable Restaurant peut ajouter une ligne pour son propre département", async () => {
    await authed(app, restaurantManagerToken)
      .post(`/api/v1/budgets/${budgetId}/lines`)
      .send({ type: "EXPENSE", plannedAmount: 25000, departmentId: restaurantDepartmentId })
      .expect(201);
  });
});

// Domaine RH — aucun des 5 modèles (Employee excepté) n'a de departmentId direct ; le scope passe
// par employee.departmentId (jointure). Un seul tenant partagé par tous les `it()` de ce describe
// (au lieu d'un beforeAll par ressource) pour éviter de recréer 5 fois la même paire
// admin/responsable Restaurant + départements — les ressources RH elles-mêmes (employés,
// plannings, pointages, congés, bulletins) sont créées ressource par ressource, chacune dans son
// propre `it()`, pour rester lisible.
describe("Scope départemental (assertInDepartmentScope, domaine RH)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let restaurantManagerToken: string;
  let restaurantDepartmentId: string;
  let housekeepingDepartmentId: string;
  let restaurantEmployeeId: string;
  let housekeepingEmployeeId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "dept-scope-hr-org");
    adminToken = await loginAndGetToken(app, tenant.email, tenant.password);

    const restaurantManager = await createUserInHotel(
      prisma,
      tenant.organizationId,
      tenant.roleId,
      tenant.hotelId,
      "dept-scope-hr-restaurant-manager"
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

    const restaurantEmployee = await authed(app, adminToken)
      .post("/api/v1/employees")
      .send({ firstName: "Fatou", lastName: "Cuisinière", baseSalary: 1500000, departmentId: restaurantDepartmentId })
      .expect(201);
    restaurantEmployeeId = restaurantEmployee.body.id;

    const housekeepingEmployee = await authed(app, adminToken)
      .post("/api/v1/employees")
      .send({ firstName: "Mariam", lastName: "Femme de chambre", baseSalary: 1200000, departmentId: housekeepingDepartmentId })
      .expect(201);
    housekeepingEmployeeId = housekeepingEmployee.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("Employees — un admin sans affectation voit tous les employés (pas de régression)", async () => {
    const response = await authed(app, adminToken).get("/api/v1/employees").expect(200);
    const ids = response.body.map((e: { id: string }) => e.id);
    expect(ids).toContain(restaurantEmployeeId);
    expect(ids).toContain(housekeepingEmployeeId);
  });

  it("Employees — un responsable Restaurant ne voit que les employés de son département", async () => {
    const response = await authed(app, restaurantManagerToken).get("/api/v1/employees").expect(200);
    const ids = response.body.map((e: { id: string }) => e.id);
    expect(ids).toContain(restaurantEmployeeId);
    expect(ids).not.toContain(housekeepingEmployeeId);
  });

  it("Employees — 403 sur un employé d'un autre département, 200 sur le sien", async () => {
    await authed(app, restaurantManagerToken).get(`/api/v1/employees/${housekeepingEmployeeId}`).expect(403);
    await authed(app, restaurantManagerToken).get(`/api/v1/employees/${restaurantEmployeeId}`).expect(200);
  });

  it("Employees — un responsable Restaurant ne peut pas créer un employé pour un autre département", async () => {
    await authed(app, restaurantManagerToken)
      .post("/api/v1/employees")
      .send({ firstName: "Test", lastName: "Rejeté", baseSalary: 1000000, departmentId: housekeepingDepartmentId })
      .expect(403);
  });

  it("WorkSchedules — filtrage liste + 403/200 findOne + refus de créer hors département", async () => {
    const restaurantSchedule = await authed(app, adminToken)
      .post("/api/v1/work-schedules")
      .send({ employeeId: restaurantEmployeeId, startAt: "2026-09-01T08:00:00.000Z", endAt: "2026-09-01T16:00:00.000Z" })
      .expect(201);
    const housekeepingSchedule = await authed(app, adminToken)
      .post("/api/v1/work-schedules")
      .send({ employeeId: housekeepingEmployeeId, startAt: "2026-09-01T08:00:00.000Z", endAt: "2026-09-01T16:00:00.000Z" })
      .expect(201);

    const list = await authed(app, restaurantManagerToken).get("/api/v1/work-schedules").expect(200);
    const ids = list.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(restaurantSchedule.body.id);
    expect(ids).not.toContain(housekeepingSchedule.body.id);

    await authed(app, restaurantManagerToken).get(`/api/v1/work-schedules/${housekeepingSchedule.body.id}`).expect(403);
    await authed(app, restaurantManagerToken).get(`/api/v1/work-schedules/${restaurantSchedule.body.id}`).expect(200);

    await authed(app, restaurantManagerToken)
      .post("/api/v1/work-schedules")
      .send({ employeeId: housekeepingEmployeeId, startAt: "2026-09-02T08:00:00.000Z", endAt: "2026-09-02T16:00:00.000Z" })
      .expect(403);
  });

  it("Attendance — filtrage liste + 403/200 findOne + clockOut refusé hors département", async () => {
    const restaurantAttendance = await authed(app, adminToken)
      .post("/api/v1/attendances")
      .send({ employeeId: restaurantEmployeeId })
      .expect(201);
    const housekeepingAttendance = await authed(app, adminToken)
      .post("/api/v1/attendances")
      .send({ employeeId: housekeepingEmployeeId })
      .expect(201);

    const list = await authed(app, restaurantManagerToken).get("/api/v1/attendances").expect(200);
    const ids = list.body.map((a: { id: string }) => a.id);
    expect(ids).toContain(restaurantAttendance.body.id);
    expect(ids).not.toContain(housekeepingAttendance.body.id);

    await authed(app, restaurantManagerToken).get(`/api/v1/attendances/${housekeepingAttendance.body.id}`).expect(403);

    await authed(app, restaurantManagerToken)
      .post(`/api/v1/attendances/${housekeepingAttendance.body.id}/clock-out`)
      .expect(403);
    await authed(app, restaurantManagerToken)
      .post(`/api/v1/attendances/${restaurantAttendance.body.id}/clock-out`)
      .expect(201);
  });

  it("LeaveRequests — filtrage liste + 403/200 findOne + approve refusé hors département", async () => {
    const restaurantLeave = await authed(app, adminToken)
      .post("/api/v1/leave-requests")
      .send({ employeeId: restaurantEmployeeId, startDate: "2026-10-01", endDate: "2026-10-03" })
      .expect(201);
    const housekeepingLeave = await authed(app, adminToken)
      .post("/api/v1/leave-requests")
      .send({ employeeId: housekeepingEmployeeId, startDate: "2026-10-01", endDate: "2026-10-03" })
      .expect(201);

    const list = await authed(app, restaurantManagerToken).get("/api/v1/leave-requests").expect(200);
    const ids = list.body.map((l: { id: string }) => l.id);
    expect(ids).toContain(restaurantLeave.body.id);
    expect(ids).not.toContain(housekeepingLeave.body.id);

    await authed(app, restaurantManagerToken).get(`/api/v1/leave-requests/${housekeepingLeave.body.id}`).expect(403);

    await authed(app, restaurantManagerToken)
      .post(`/api/v1/leave-requests/${housekeepingLeave.body.id}/approve`)
      .expect(403);
    await authed(app, restaurantManagerToken)
      .post(`/api/v1/leave-requests/${restaurantLeave.body.id}/approve`)
      .expect(201);
  });

  it("Payslips — filtrage liste + 403/200 findOne (confidentialité salariale par département)", async () => {
    const restaurantPayslip = await authed(app, adminToken)
      .post("/api/v1/payslips")
      .send({ employeeId: restaurantEmployeeId, periodYear: 2026, periodMonth: 9 })
      .expect(201);
    const housekeepingPayslip = await authed(app, adminToken)
      .post("/api/v1/payslips")
      .send({ employeeId: housekeepingEmployeeId, periodYear: 2026, periodMonth: 9 })
      .expect(201);

    const list = await authed(app, restaurantManagerToken).get("/api/v1/payslips").expect(200);
    const ids = list.body.map((p: { id: string }) => p.id);
    expect(ids).toContain(restaurantPayslip.body.id);
    expect(ids).not.toContain(housekeepingPayslip.body.id);

    await authed(app, restaurantManagerToken).get(`/api/v1/payslips/${housekeepingPayslip.body.id}`).expect(403);
    await authed(app, restaurantManagerToken).get(`/api/v1/payslips/${restaurantPayslip.body.id}`).expect(200);
  });
});
