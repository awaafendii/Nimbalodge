import { Prisma } from "@prisma/client";

import type { NotificationsService } from "../notifications/notifications.service";
import type { PrismaService } from "../../database/prisma.service";
import type { StockMovementsService } from "../stock-movements/stock-movements.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { ProductsService } from "./products.service";

// Unit — couvre uniquement findBelowThreshold() (extrait de checkLowStock() à l'Étape 8 Nimba AI,
// pour une lecture sans effet de bord réutilisable par StockAnomalyDetector) et confirme que
// checkLowStock() garde exactement le même comportement observable après ce refactor (aucune
// régression sur le lowStockCount/notificationsCreated existants).
describe("ProductsService", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };

  function buildService() {
    const prisma = {
      product: { findMany: jest.fn() },
      hotel: { findUniqueOrThrow: jest.fn() },
    };
    const stockMovementsService = { computeOnHand: jest.fn() };
    const notificationsService = { notifyUsersWithPermission: jest.fn().mockResolvedValue(1) };
    const service = new ProductsService(
      prisma as unknown as PrismaService,
      stockMovementsService as unknown as StockMovementsService,
      notificationsService as unknown as NotificationsService
    );
    return { service, prisma, stockMovementsService, notificationsService };
  }

  describe("findBelowThreshold", () => {
    it("ne renvoie que les produits sous leur seuil minimum, jamais un effet de bord (aucune notification)", async () => {
      const { service, prisma, stockMovementsService, notificationsService } = buildService();
      prisma.product.findMany.mockResolvedValue([
        { id: "p1", name: "Savon", hotelId: "hotel-1", minThreshold: new Prisma.Decimal(10) },
        { id: "p2", name: "Shampoing", hotelId: "hotel-1", minThreshold: new Prisma.Decimal(5) },
      ]);
      stockMovementsService.computeOnHand.mockImplementation((_hotelId: string, productId: string) =>
        Promise.resolve(new Map([["warehouse-1", new Prisma.Decimal(productId === "p1" ? 3 : 20)]]))
      );

      const result = await service.findBelowThreshold(user);

      expect(result).toEqual([
        { productId: "p1", name: "Savon", hotelId: "hotel-1", onHand: new Prisma.Decimal(3), threshold: new Prisma.Decimal(10) },
      ]);
      expect(notificationsService.notifyUsersWithPermission).not.toHaveBeenCalled();
    });
  });

  describe("checkLowStock (comportement inchangé après le refactor Étape 8)", () => {
    it("déclenche toujours une notification par produit sous seuil et renvoie le même comptage", async () => {
      const { service, prisma, stockMovementsService, notificationsService } = buildService();
      prisma.product.findMany.mockResolvedValue([
        { id: "p1", name: "Savon", hotelId: "hotel-1", minThreshold: new Prisma.Decimal(10) },
      ]);
      stockMovementsService.computeOnHand.mockResolvedValue(new Map([["warehouse-1", new Prisma.Decimal(3)]]));
      prisma.hotel.findUniqueOrThrow.mockResolvedValue({ id: "hotel-1", organizationId: "org-1" });

      const result = await service.checkLowStock(user);

      expect(result).toEqual({ lowStockCount: 1, notificationsCreated: 1 });
      expect(notificationsService.notifyUsersWithPermission).toHaveBeenCalledTimes(1);
    });
  });
});
