import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { toPurchaseOrderResponse } from "./dto/purchase-order-response.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";

const FULL_INCLUDE = { lines: true, goodsReceipts: { include: { lines: true } } } as const;

type PurchaseOrderFields = Pick<
  CreatePurchaseOrderDto | UpdatePurchaseOrderDto,
  "supplierId" | "purchaseRequestId"
>;

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      include: FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return purchaseOrders.map(toPurchaseOrderResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const purchaseOrder = await this.findFullOrThrow(id);
    this.assertInScope(purchaseOrder.hotel.organizationId, purchaseOrder.hotelId, requester);
    return toPurchaseOrderResponse(purchaseOrder);
  }

  async create(dto: CreatePurchaseOrderDto, requester: AuthenticatedUser) {
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

    await this.validateReferences(hotelId, dto);

    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        hotelId,
        supplierId: dto.supplierId,
        purchaseRequestId: dto.purchaseRequestId,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        currency: dto.currency,
        notes: dto.notes,
        createdById: requester.id,
        lines: {
          create: dto.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        },
      },
      include: FULL_INCLUDE,
    });
    return toPurchaseOrderResponse(purchaseOrder);
  }

  async update(id: string, dto: UpdatePurchaseOrderDto, requester: AuthenticatedUser) {
    const purchaseOrder = await this.findFullOrThrow(id);
    this.assertInScope(purchaseOrder.hotel.organizationId, purchaseOrder.hotelId, requester);
    if (purchaseOrder.status !== "DRAFT") {
      throw new BadRequestException("Seule une commande en brouillon peut être modifiée");
    }

    await this.validateReferences(purchaseOrder.hotelId, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderLine.createMany({
          data: dto.lines.map((line) => ({
            purchaseOrderId: id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        });
      }
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          purchaseRequestId: dto.purchaseRequestId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
          notes: dto.notes,
        },
        include: FULL_INCLUDE,
      });
    });

    return toPurchaseOrderResponse(updated);
  }

  // Numéro assigné à l'envoi, pas à la création (une commande abandonnée ne consomme pas de
  // numéro) — même principe qu'Invoice.invoiceNumber assigné à issue() (Phase 6).
  async send(id: string, requester: AuthenticatedUser) {
    const purchaseOrder = await this.findFullOrThrow(id);
    this.assertInScope(purchaseOrder.hotel.organizationId, purchaseOrder.hotelId, requester);
    if (purchaseOrder.status !== "DRAFT") {
      throw new BadRequestException("Seule une commande en brouillon peut être envoyée");
    }
    if (purchaseOrder.lines.length === 0) {
      throw new BadRequestException("La commande doit contenir au moins une ligne");
    }

    const year = new Date().getUTCFullYear();
    const prefix = `PO-${year}-`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.purchaseOrder.count({
        where: { hotelId: purchaseOrder.hotelId, orderNumber: { startsWith: prefix } },
      });
      const orderNumber = `${prefix}${String(existingCount + 1).padStart(4, "0")}`;
      return tx.purchaseOrder.update({
        where: { id },
        data: { status: "SENT", orderNumber, orderDate: purchaseOrder.orderDate ?? new Date() },
        include: FULL_INCLUDE,
      });
    });

    return toPurchaseOrderResponse(updated);
  }

  // Impossible dès qu'une réception existe (miroir de l'annulation Invoice bloquée si des
  // paiements existent, Phase 6) — une commande partiellement/totalement reçue ne s'annule pas.
  async cancel(id: string, requester: AuthenticatedUser) {
    const purchaseOrder = await this.findFullOrThrow(id);
    this.assertInScope(purchaseOrder.hotel.organizationId, purchaseOrder.hotelId, requester);
    if (purchaseOrder.status === "CANCELLED") {
      throw new BadRequestException("Cette commande est déjà annulée");
    }
    if (purchaseOrder.goodsReceipts.length > 0) {
      throw new BadRequestException("Impossible d'annuler une commande ayant des réceptions enregistrées");
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: FULL_INCLUDE,
    });
    return toPurchaseOrderResponse(updated);
  }

  // Réutilisé par GoodsReceiptsService dans son propre $transaction — jamais de PATCH manuel vers
  // PARTIALLY_RECEIVED/RECEIVED (même principe qu'InvoicesService.recalculateStatus, Phase 6).
  async recalculateStatus(tx: Prisma.TransactionClient, purchaseOrderId: string): Promise<void> {
    const purchaseOrder = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { lines: true, goodsReceipts: { include: { lines: true } } },
    });
    if (purchaseOrder.status === "CANCELLED" || purchaseOrder.status === "DRAFT") {
      return;
    }

    let anyReceived = false;
    let allFullyReceived = true;
    for (const line of purchaseOrder.lines) {
      const received = purchaseOrder.goodsReceipts
        .flatMap((receipt) => receipt.lines)
        .filter((receiptLine) => receiptLine.purchaseOrderLineId === line.id)
        .reduce((sum, receiptLine) => sum.plus(receiptLine.quantityReceived), new Prisma.Decimal(0));
      if (received.greaterThan(0)) {
        anyReceived = true;
      }
      if (received.lessThan(line.quantity)) {
        allFullyReceived = false;
      }
    }

    const newStatus = allFullyReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : purchaseOrder.status;
    if (newStatus !== purchaseOrder.status) {
      await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: newStatus } });
    }
  }

  async findFullOrThrow(id: string) {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { ...FULL_INCLUDE, hotel: true },
    });
    if (!purchaseOrder) {
      throw new NotFoundException("Commande introuvable");
    }
    return purchaseOrder;
  }

  assertInScope(organizationId: string, hotelId: string, requester: AuthenticatedUser): void {
    if (organizationId !== requester.organizationId) {
      throw new ForbiddenException("Hors périmètre de votre organisation");
    }
    if (requester.hotelId && hotelId !== requester.hotelId) {
      throw new ForbiddenException("Hors périmètre de votre hôtel");
    }
  }

  private async validateReferences(hotelId: string, dto: PurchaseOrderFields): Promise<void> {
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier || supplier.hotelId !== hotelId || !supplier.isActive) {
        throw new BadRequestException("Fournisseur invalide");
      }
    }
    if (dto.purchaseRequestId) {
      const purchaseRequest = await this.prisma.purchaseRequest.findUnique({ where: { id: dto.purchaseRequestId } });
      if (!purchaseRequest || purchaseRequest.hotelId !== hotelId) {
        throw new BadRequestException("Demande d'achat invalide");
      }
      if (purchaseRequest.status !== "APPROVED") {
        throw new BadRequestException("La demande d'achat référencée doit être approuvée");
      }
    }
  }
}
