import { INestApplication } from "@nestjs/common";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// Vérifie la règle centrale de docs/business-rules/finance.md §2 : Revenue et Invoice/Payment
// sont deux mécanismes de constatation de recette qui coexistent SANS fusion — un Payment ne crée
// jamais de Revenue, et le dashboard les additionne sans double-comptage.
describe("Intégrité finance (Revenue / Invoice+Payment)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let hotelId: string;
  let cashAccountId: string;
  let revenueCategoryId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);

    const tenant = await createTenant(prisma, "finance-integrity-org");
    hotelId = tenant.hotelId;
    token = await loginAndGetToken(app, tenant.email, tenant.password);

    const cashAccount = await authed(app, token)
      .post("/api/v1/cash-accounts")
      .send({ name: "Caisse principale", openingBalance: 0 })
      .expect(201);
    cashAccountId = cashAccount.body.id;

    const category = await authed(app, token)
      .post("/api/v1/financial-categories")
      .send({ name: "Hébergement", type: "REVENUE" })
      .expect(201);
    revenueCategoryId = category.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("une Revenue crée exactement une CashTransaction IN et met à jour le solde", async () => {
    await authed(app, token)
      .post("/api/v1/revenues")
      .send({ categoryId: revenueCategoryId, amount: 100000, paymentMethod: "CASH", cashAccountId })
      .expect(201);

    const transactions = await prisma.cashTransaction.findMany({ where: { cashAccountId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.direction).toBe("IN");
    expect(transactions[0]!.amount.toString()).toBe("100000");

    const account = await authed(app, token).get(`/api/v1/cash-accounts/${cashAccountId}`).expect(200);
    expect(account.body.balance).toBe("100000");
  });

  it("un Invoice payé ne crée jamais de ligne Revenue", async () => {
    const invoice = await authed(app, token)
      .post("/api/v1/invoices")
      .send({
        categoryId: revenueCategoryId,
        clientName: "Client Test",
        lines: [{ description: "Nuitée", quantity: 1, unitPrice: 50000 }],
      })
      .expect(201);
    const invoiceId = invoice.body.id;

    await authed(app, token).post(`/api/v1/invoices/${invoiceId}/issue`).expect(201);

    const revenueCountBefore = await prisma.revenue.count({ where: { hotelId } });

    await authed(app, token)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .send({ amount: 50000, paymentMethod: "CASH", cashAccountId })
      .expect(201);

    const revenueCountAfter = await prisma.revenue.count({ where: { hotelId } });
    expect(revenueCountAfter).toBe(revenueCountBefore);

    const paidInvoice = await authed(app, token).get(`/api/v1/invoices/${invoiceId}`).expect(200);
    expect(paidInvoice.body.status).toBe("PAID");
  });

  it("GET /finance/summary additionne Revenue + Payment sans double-comptage", async () => {
    // UTC explicitement : FinanceSummaryService borne la période en UTC (Date.UTC), pas en heure
    // locale — faire pareil ici évite un flake autour d'un changement de mois selon le fuseau de
    // la machine qui exécute les tests.
    const now = new Date();
    const summary = await authed(app, token)
      .get(`/api/v1/finance/summary?month=${now.getUTCMonth() + 1}&year=${now.getUTCFullYear()}`)
      .expect(200);

    // 100000 (Revenue de la 1ère assertion) + 50000 (Payment de la 2e assertion) = 150000, jamais
    // 200000 (qui indiquerait un double-comptage du Payment côté Revenue) ni 50000/100000 seuls
    // (qui indiquerait qu'une des deux sources est ignorée).
    expect(summary.body.totalRevenue).toBe("150000");
  });
});
