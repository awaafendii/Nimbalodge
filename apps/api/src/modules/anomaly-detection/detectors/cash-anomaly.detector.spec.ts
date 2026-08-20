import { Prisma } from "@prisma/client";

import type { CashAccountsService } from "../../cash-accounts/cash-accounts.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { CashAnomalyDetector } from "./cash-anomaly.detector";

describe("CashAnomalyDetector", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = new Date("2026-08-01T00:00:00Z");
  const dateTo = new Date("2026-09-01T00:00:00Z");

  function buildDetector() {
    const cashAccountsService = { list: jest.fn(), listTransactions: jest.fn() };
    const detector = new CashAnomalyDetector(cashAccountsService as unknown as CashAccountsService);
    return { detector, cashAccountsService };
  }

  it("signale une sortie de caisse largement supérieure à la moyenne de la période précédente", async () => {
    const { detector, cashAccountsService } = buildDetector();
    cashAccountsService.list.mockResolvedValue([{ id: "account-1", name: "Caisse principale" }]);
    cashAccountsService.listTransactions.mockResolvedValue([
      { id: "tx-prev-1", direction: "OUT", amount: new Prisma.Decimal(100), label: "Achat", date: new Date("2026-07-10") },
      { id: "tx-prev-2", direction: "OUT", amount: new Prisma.Decimal(100), label: "Achat", date: new Date("2026-07-15") },
      { id: "tx-cur-1", direction: "OUT", amount: new Prisma.Decimal(500), label: "Grosse sortie", date: new Date("2026-08-10") },
    ]);

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ resourceType: "cash-transaction", resourceId: "tx-cur-1" });
  });

  it("ignore une caisse sans sortie sur la période précédente (pas de référence)", async () => {
    const { detector, cashAccountsService } = buildDetector();
    cashAccountsService.list.mockResolvedValue([{ id: "account-1", name: "Caisse principale" }]);
    cashAccountsService.listTransactions.mockResolvedValue([
      { id: "tx-cur-1", direction: "OUT", amount: new Prisma.Decimal(500), label: "Sortie", date: new Date("2026-08-10") },
    ]);

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
  });

  it("ignore les transactions IN (entrées de caisse)", async () => {
    const { detector, cashAccountsService } = buildDetector();
    cashAccountsService.list.mockResolvedValue([{ id: "account-1", name: "Caisse principale" }]);
    cashAccountsService.listTransactions.mockResolvedValue([
      { id: "tx-prev-1", direction: "OUT", amount: new Prisma.Decimal(100), label: "Achat", date: new Date("2026-07-10") },
      { id: "tx-cur-1", direction: "IN", amount: new Prisma.Decimal(5000), label: "Recette", date: new Date("2026-08-10") },
    ]);

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
  });
});
