import { Prisma } from "@prisma/client";

import type { ProductsService } from "../../products/products.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { StockAnomalyDetector } from "./stock-anomaly.detector";

describe("StockAnomalyDetector", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = new Date("2026-08-01T00:00:00Z");
  const dateTo = new Date("2026-09-01T00:00:00Z");

  it("reformate findBelowThreshold() en anomalies, sans recalcul", async () => {
    const productsService = { findBelowThreshold: jest.fn() };
    productsService.findBelowThreshold.mockResolvedValue([
      { productId: "p1", name: "Savon", hotelId: "hotel-1", onHand: new Prisma.Decimal(3), threshold: new Prisma.Decimal(10) },
    ]);
    const detector = new StockAnomalyDetector(productsService as unknown as ProductsService);

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([
      expect.objectContaining({ resourceType: "product", resourceId: "p1", observedValue: "3", referenceValue: "10" }),
    ]);
  });

  it("renvoie un tableau vide si rien n'est sous le seuil", async () => {
    const productsService = { findBelowThreshold: jest.fn().mockResolvedValue([]) };
    const detector = new StockAnomalyDetector(productsService as unknown as ProductsService);

    const result = await detector.detect(user, dateFrom, dateTo);

    expect(result).toEqual([]);
  });
});
