import { INestApplication } from "@nestjs/common";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Vérifie docs/business-rules/finance.md §3 : la CashTransaction d'une Expense n'est créée
// qu'à mark-paid, jamais avant (DRAFT/PENDING/APPROVED n'ont bougé aucun argent réel), et jamais
// en sautant une étape du workflow.
describe("Workflow Expense (DRAFT → PENDING → APPROVED → PAID → BOOKED)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let cashAccountId: string;
  let expenseCategoryId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "expense-workflow-org");
    token = await loginAndGetToken(app, tenant.email, tenant.password);

    const cashAccount = await authed(app, token)
      .post("/api/v1/cash-accounts")
      .send({ name: "Caisse principale", openingBalance: 500000 })
      .expect(201);
    cashAccountId = cashAccount.body.id;

    const category = await authed(app, token)
      .post("/api/v1/financial-categories")
      .send({ name: "Électricité", type: "EXPENSE" })
      .expect(201);
    expenseCategoryId = category.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function balance(): Promise<string> {
    const response = await authed(app, token).get(`/api/v1/cash-accounts/${cashAccountId}`).expect(200);
    return response.body.balance;
  }

  it("ne bouge aucun argent avant mark-paid (DRAFT → PENDING → APPROVED)", async () => {
    const created = await authed(app, token)
      .post("/api/v1/expenses")
      .send({
        categoryId: expenseCategoryId,
        amount: 300000,
        paymentMethod: "CASH",
        cashAccountId,
      })
      .expect(201);
    const expenseId = created.body.id;
    expect(await balance()).toBe("500000");

    await authed(app, token).post(`/api/v1/expenses/${expenseId}/submit`).expect(201);
    expect(await balance()).toBe("500000");

    await authed(app, token).post(`/api/v1/expenses/${expenseId}/approve`).expect(201);
    expect(await balance()).toBe("500000");

    const transactionsBeforePaid = await prisma.cashTransaction.count({ where: { expenseId } });
    expect(transactionsBeforePaid).toBe(0);

    await authed(app, token).post(`/api/v1/expenses/${expenseId}/mark-paid`).expect(201);
    expect(await balance()).toBe("200000");

    const transactionsAfterPaid = await prisma.cashTransaction.findMany({ where: { expenseId } });
    expect(transactionsAfterPaid).toHaveLength(1);
    expect(transactionsAfterPaid[0]!.direction).toBe("OUT");
    expect(transactionsAfterPaid[0]!.amount.toString()).toBe("300000");

    await authed(app, token).post(`/api/v1/expenses/${expenseId}/book`).expect(201);
    expect(await balance()).toBe("200000");

    const transactionsAfterBook = await prisma.cashTransaction.count({ where: { expenseId } });
    expect(transactionsAfterBook).toBe(1);
  });

  it("refuse de sauter une étape (mark-paid direct depuis DRAFT) sans créer de transaction", async () => {
    const created = await authed(app, token)
      .post("/api/v1/expenses")
      .send({
        categoryId: expenseCategoryId,
        amount: 75000,
        paymentMethod: "CASH",
        cashAccountId,
      })
      .expect(201);
    const expenseId = created.body.id;
    const balanceBefore = await balance();

    await authed(app, token).post(`/api/v1/expenses/${expenseId}/mark-paid`).expect(400);

    expect(await balance()).toBe(balanceBefore);
    const transactions = await prisma.cashTransaction.count({ where: { expenseId } });
    expect(transactions).toBe(0);
  });
});
