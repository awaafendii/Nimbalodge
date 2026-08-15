import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import { toGoodsReceiptResponse } from "./dto/goods-receipt-response.dto";
import { PurchaseOrdersService } from "./purchase-orders.service";

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseOrdersService: PurchaseOrdersService
  ) {}

  async list(purchaseOrderId: string, requester: AuthenticatedUser) {
    const purchaseOrder = await this.purchaseOrdersService.findFullOrThrow(purchaseOrderId);
    this.purchaseOrdersService.assertInScope(purchaseOrder.hotel.organizationId, purchaseOrder.hotelId, requester);
    const goodsReceipts = await this.prisma.goodsReceipt.findMany({
      where: { purchaseOrderId },
      include: { lines: true },
      orderBy: { date: "asc" },
    });
    return goodsReceipts.map(toGoodsReceiptResponse);
  }

  // Fait immuable une fois créé (pas de PATCH/DELETE, même statut que Payment/CreditNote). Contrôle
  // de non-dépassement : la quantité reçue cumulée par ligne ne peut jamais excéder la quantité
  // commandée — contrôle d'inventaire réel, pas de sur-réception silencieuse.
  async create(purchaseOrderId: string, dto: CreateGoodsReceiptDto, requester: AuthenticatedUser) {
    const purchaseOrder = await this.purchaseOrdersService.findFullOrThrow(purchaseOrderId);
    this.purchaseOrdersService.assertInScope(purchaseOrder.hotel.organizationId, purchaseOrder.hotelId, requester);

    if (purchaseOrder.status !== "SENT" && purchaseOrder.status !== "PARTIALLY_RECEIVED") {
      throw new BadRequestException("La commande doit être envoyée et non totalement reçue pour recevoir une réception");
    }

    const alreadyReceived = new Map<string, Prisma.Decimal>();
    for (const receipt of purchaseOrder.goodsReceipts) {
      for (const line of receipt.lines) {
        const current = alreadyReceived.get(line.purchaseOrderLineId) ?? new Prisma.Decimal(0);
        alreadyReceived.set(line.purchaseOrderLineId, current.plus(line.quantityReceived));
      }
    }

    for (const inputLine of dto.lines) {
      const orderLine = purchaseOrder.lines.find((line) => line.id === inputLine.purchaseOrderLineId);
      if (!orderLine) {
        throw new BadRequestException("Ligne de commande invalide");
      }
      const current = alreadyReceived.get(inputLine.purchaseOrderLineId) ?? new Prisma.Decimal(0);
      const next = current.plus(inputLine.quantityReceived);
      if (next.greaterThan(orderLine.quantity)) {
        throw new BadRequestException(
          `Quantité reçue (${next.toString()}) dépasserait la quantité commandée (${orderLine.quantity.toString()}) pour la ligne "${orderLine.description}"`
        );
      }
      alreadyReceived.set(inputLine.purchaseOrderLineId, next);
    }

    const goodsReceipt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId,
          date: dto.date ? new Date(dto.date) : undefined,
          notes: dto.notes,
          createdById: requester.id,
          lines: {
            create: dto.lines.map((line) => ({
              purchaseOrderLineId: line.purchaseOrderLineId,
              quantityReceived: line.quantityReceived,
            })),
          },
        },
        include: { lines: true },
      });

      await this.purchaseOrdersService.recalculateStatus(tx, purchaseOrderId);

      return created;
    });

    return toGoodsReceiptResponse(goodsReceipt);
  }
}
