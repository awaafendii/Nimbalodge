import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { StockMovementsService } from "../stock-movements/stock-movements.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { toProductResponse } from "./dto/product-response.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementsService: StockMovementsService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(requester: AuthenticatedUser) {
    const products = await this.prisma.product.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return products.map(toProductResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const product = await this.findWithHotelOrThrow(id);
    assertInScope(product.hotel.organizationId, product.hotelId, requester);
    return toProductResponse(product);
  }

  async create(dto: CreateProductDto, requester: AuthenticatedUser) {
    const hotelId = requester.hotelId ?? dto.hotelId;
    if (!hotelId) {
      throw new BadRequestException("hotelId requis");
    }
    if (requester.hotelId && dto.hotelId && dto.hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }

    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.organizationId !== requester.organizationId) {
      throw new BadRequestException("Hôtel invalide");
    }

    const existing = await this.prisma.product.findUnique({
      where: { hotelId_name: { hotelId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException("Un produit avec ce nom existe déjà pour cet hôtel");
    }

    const product = await this.prisma.product.create({
      data: {
        hotelId,
        name: dto.name,
        sku: dto.sku,
        unit: dto.unit,
        category: dto.category,
        minThreshold: dto.minThreshold,
        notes: dto.notes,
      },
    });
    return toProductResponse(product);
  }

  async update(id: string, dto: UpdateProductDto, requester: AuthenticatedUser) {
    const product = await this.findWithHotelOrThrow(id);
    assertInScope(product.hotel.organizationId, product.hotelId, requester);

    if (dto.name && dto.name !== product.name) {
      const existing = await this.prisma.product.findUnique({
        where: { hotelId_name: { hotelId: product.hotelId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException("Un produit avec ce nom existe déjà pour cet hôtel");
      }
    }

    const updated = await this.prisma.product.update({ where: { id }, data: dto });
    return toProductResponse(updated);
  }

  // Quantité en stock jamais dénormalisée sur Product (voir StockMovementsService.computeOnHand).
  async getStock(id: string, requester: AuthenticatedUser) {
    const product = await this.findWithHotelOrThrow(id);
    assertInScope(product.hotel.organizationId, product.hotelId, requester);

    const balances = await this.stockMovementsService.computeOnHand(product.hotelId, id);
    const warehouses = await this.prisma.warehouse.findMany({ where: { id: { in: [...balances.keys()] } } });
    const warehouseNames = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));

    const byWarehouse = [...balances.entries()].map(([warehouseId, quantity]) => ({
      warehouseId,
      warehouseName: warehouseNames.get(warehouseId) ?? warehouseId,
      quantity,
    }));
    const total = byWarehouse.reduce((sum, entry) => sum.plus(entry.quantity), new Prisma.Decimal(0));

    return { productId: id, byWarehouse, total };
  }

  // "Alertes" (§24) — même mécanisme que BudgetsService.checkOverspendAlerts() (Phase 12) :
  // déclenchement à la demande, fan-out + déduplication délégués à NotificationsService.
  async checkLowStock(requester: AuthenticatedUser) {
    const hotelWhere = requester.hotelId
      ? { hotelId: requester.hotelId }
      : { hotel: { organizationId: requester.organizationId } };

    const products = await this.prisma.product.findMany({
      where: { ...hotelWhere, isActive: true, minThreshold: { not: null } },
    });

    let lowStockCount = 0;
    let notificationsCreated = 0;
    for (const product of products) {
      const balances = await this.stockMovementsService.computeOnHand(product.hotelId, product.id);
      const total = [...balances.values()].reduce((sum, quantity) => sum.plus(quantity), new Prisma.Decimal(0));
      if (product.minThreshold && total.lessThan(product.minThreshold)) {
        lowStockCount += 1;
        const hotel = await this.prisma.hotel.findUniqueOrThrow({ where: { id: product.hotelId } });
        notificationsCreated += await this.notificationsService.notifyUsersWithPermission({
          hotelId: product.hotelId,
          organizationId: hotel.organizationId,
          permissionKey: "products.view",
          type: "product_low_stock",
          title: `Stock bas — ${product.name}`,
          message: `"${product.name}" est sous le seuil minimum : ${total.toString()} en stock pour un seuil de ${product.minThreshold.toString()}.`,
          link: `/products/${product.id}`,
          relatedType: "product",
          relatedId: product.id,
        });
      }
    }

    return { lowStockCount, notificationsCreated };
  }

  private async findWithHotelOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { hotel: true } });
    if (!product) {
      throw new NotFoundException("Produit introuvable");
    }
    return product;
  }
}
