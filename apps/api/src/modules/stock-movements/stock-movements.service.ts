import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { ListStockMovementsQueryDto } from "./dto/list-stock-movements-query.dto";
import { toStockMovementResponse } from "./dto/stock-movement-response.dto";

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListStockMovementsQueryDto, requester: AuthenticatedUser) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        ...(requester.hotelId
          ? { hotelId: requester.hotelId }
          : { hotel: { organizationId: requester.organizationId } }),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      },
      orderBy: { date: "desc" },
    });
    return movements.map(toStockMovementResponse);
  }

  // Couvre IN/OUT/CONSUMPTION/LOSS — même effet mécanique pour ces trois derniers (diminuent le
  // stock de warehouseId), distingués seulement pour la catégorisation (voir schema.prisma).
  async create(dto: CreateStockMovementDto, requester: AuthenticatedUser) {
    const hotelId = await this.resolveHotelId(requester, dto.hotelId);
    await this.validateProduct(hotelId, dto.productId);
    await this.validateWarehouse(hotelId, dto.warehouseId);
    if (dto.goodsReceiptId) {
      await this.validateGoodsReceipt(hotelId, dto.goodsReceiptId);
    }
    if (dto.type !== "IN") {
      await this.assertSufficientStock(hotelId, dto.productId, dto.warehouseId, dto.quantity);
    }

    const movement = await this.prisma.stockMovement.create({
      data: {
        hotelId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        type: dto.type,
        quantity: dto.quantity,
        date: dto.date ? new Date(dto.date) : undefined,
        reference: dto.reference,
        notes: dto.notes,
        goodsReceiptId: dto.goodsReceiptId,
        createdById: requester.id,
      },
    });
    return toStockMovementResponse(movement);
  }

  async createTransfer(dto: CreateTransferDto, requester: AuthenticatedUser) {
    const hotelId = await this.resolveHotelId(requester, dto.hotelId);
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException("L'entrepôt source et l'entrepôt destination doivent être différents");
    }
    await this.validateProduct(hotelId, dto.productId);
    await this.validateWarehouse(hotelId, dto.fromWarehouseId);
    await this.validateWarehouse(hotelId, dto.toWarehouseId);
    await this.assertSufficientStock(hotelId, dto.productId, dto.fromWarehouseId, dto.quantity);

    const movement = await this.prisma.stockMovement.create({
      data: {
        hotelId,
        productId: dto.productId,
        warehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        type: "TRANSFER",
        quantity: dto.quantity,
        date: dto.date ? new Date(dto.date) : undefined,
        reference: dto.reference,
        notes: dto.notes,
        createdById: requester.id,
      },
    });
    return toStockMovementResponse(movement);
  }

  async createAdjustment(dto: CreateAdjustmentDto, requester: AuthenticatedUser) {
    const hotelId = await this.resolveHotelId(requester, dto.hotelId);
    if (dto.quantity === 0) {
      throw new BadRequestException("La quantité d'ajustement ne peut pas être nulle");
    }
    await this.validateProduct(hotelId, dto.productId);
    await this.validateWarehouse(hotelId, dto.warehouseId);
    if (dto.quantity < 0) {
      await this.assertSufficientStock(hotelId, dto.productId, dto.warehouseId, Math.abs(dto.quantity));
    }

    const movement = await this.prisma.stockMovement.create({
      data: {
        hotelId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        type: "ADJUSTMENT",
        quantity: dto.quantity,
        reason: dto.reason,
        date: dto.date ? new Date(dto.date) : undefined,
        notes: dto.notes,
        createdById: requester.id,
      },
    });
    return toStockMovementResponse(movement);
  }

  // Quantité en stock JAMAIS dénormalisée — recalculée à la demande depuis tous les mouvements du
  // produit, même principe que le solde CashAccount (Phase 5). Retourne le solde par entrepôt.
  async computeOnHand(hotelId: string, productId: string): Promise<Map<string, Prisma.Decimal>> {
    const movements = await this.prisma.stockMovement.findMany({ where: { hotelId, productId } });
    const balances = new Map<string, Prisma.Decimal>();
    const add = (key: string, delta: Prisma.Decimal) => {
      balances.set(key, (balances.get(key) ?? new Prisma.Decimal(0)).plus(delta));
    };

    for (const movement of movements) {
      switch (movement.type) {
        case "IN":
          add(movement.warehouseId, movement.quantity);
          break;
        case "OUT":
        case "CONSUMPTION":
        case "LOSS":
          add(movement.warehouseId, movement.quantity.negated());
          break;
        case "TRANSFER":
          add(movement.warehouseId, movement.quantity.negated());
          if (movement.toWarehouseId) {
            add(movement.toWarehouseId, movement.quantity);
          }
          break;
        case "ADJUSTMENT":
          // Déjà signée (positive ou négative) — voir CreateAdjustmentDto.
          add(movement.warehouseId, movement.quantity);
          break;
      }
    }
    return balances;
  }

  // Contrôle d'inventaire réel — un entrepôt ne peut jamais descendre sous zéro (même principe que
  // le contrôle de non-dépassement de GoodsReceipt, Phase 9).
  private async assertSufficientStock(
    hotelId: string,
    productId: string,
    warehouseId: string,
    quantity: number
  ): Promise<void> {
    const balances = await this.computeOnHand(hotelId, productId);
    const onHand = balances.get(warehouseId) ?? new Prisma.Decimal(0);
    if (onHand.lessThan(quantity)) {
      throw new BadRequestException(
        `Stock insuffisant dans cet entrepôt (disponible : ${onHand.toString()}, demandé : ${quantity})`
      );
    }
  }

  private async resolveHotelId(requester: AuthenticatedUser, dtoHotelId: string | undefined): Promise<string> {
    const hotelId = requester.hotelId ?? dtoHotelId;
    if (!hotelId) {
      throw new BadRequestException("hotelId requis");
    }
    if (requester.hotelId && dtoHotelId && dtoHotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }
    const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel || hotel.organizationId !== requester.organizationId) {
      throw new BadRequestException("Hôtel invalide");
    }
    return hotelId;
  }

  private async validateProduct(hotelId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.hotelId !== hotelId || !product.isActive) {
      throw new BadRequestException("Produit invalide");
    }
  }

  private async validateWarehouse(hotelId: string, warehouseId: string): Promise<void> {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.hotelId !== hotelId || !warehouse.isActive) {
      throw new BadRequestException("Entrepôt invalide");
    }
  }

  private async validateGoodsReceipt(hotelId: string, goodsReceiptId: string): Promise<void> {
    const goodsReceipt = await this.prisma.goodsReceipt.findUnique({
      where: { id: goodsReceiptId },
      include: { purchaseOrder: true },
    });
    if (!goodsReceipt || goodsReceipt.purchaseOrder.hotelId !== hotelId) {
      throw new BadRequestException("Réception invalide");
    }
  }
}
