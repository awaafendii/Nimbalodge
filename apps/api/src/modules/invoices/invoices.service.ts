import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { computeInvoiceTotals, toInvoiceResponse } from "./dto/invoice-response.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";

const FULL_INCLUDE = { lines: true, payments: true, creditNotes: true } as const;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const invoices = await this.prisma.invoice.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      include: FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return invoices.map(toInvoiceResponse);
  }

  // Créances (§10) : vue calculée, pas de modèle dédié — factures ISSUED/PARTIALLY_PAID avec un
  // solde dû > 0. Route statique, déclarée avant /:id dans le contrôleur.
  async receivables(requester: AuthenticatedUser) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(requester.hotelId
          ? { hotelId: requester.hotelId }
          : { hotel: { organizationId: requester.organizationId } }),
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      },
      include: FULL_INCLUDE,
      orderBy: { dueDate: "asc" },
    });
    return invoices.map(toInvoiceResponse).filter((invoice) => invoice.dueBalance.greaterThan(0));
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const invoice = await this.findFullOrThrow(id);
    assertInScope(invoice.hotel.organizationId, invoice.hotelId, requester);
    return toInvoiceResponse(invoice);
  }

  async create(dto: CreateInvoiceDto, requester: AuthenticatedUser) {
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

    const invoice = await this.prisma.invoice.create({
      data: {
        hotelId,
        departmentId: dto.departmentId,
        activityId: dto.activityId,
        costCenterId: dto.costCenterId,
        categoryId: dto.categoryId,
        clientName: dto.clientName,
        clientType: dto.clientType,
        clientContact: dto.clientContact,
        clientAddress: dto.clientAddress,
        guestId: dto.guestId,
        reservationId: dto.reservationId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        currency: dto.currency,
        createdById: requester.id,
        lines: {
          create: dto.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountRate: line.discountRate,
            taxRate: line.taxRate,
          })),
        },
      },
      include: FULL_INCLUDE,
    });
    return toInvoiceResponse(invoice);
  }

  async update(id: string, dto: UpdateInvoiceDto, requester: AuthenticatedUser) {
    const invoice = await this.findFullOrThrow(id);
    assertInScope(invoice.hotel.organizationId, invoice.hotelId, requester);
    if (invoice.status !== "DRAFT") {
      throw new BadRequestException("Seule une facture en brouillon peut être modifiée");
    }

    await this.validateReferences(invoice.hotelId, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: dto.lines.map((line) => ({
            invoiceId: id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountRate: line.discountRate,
            taxRate: line.taxRate,
          })),
        });
      }
      return tx.invoice.update({
        where: { id },
        data: {
          categoryId: dto.categoryId,
          clientName: dto.clientName,
          clientType: dto.clientType,
          clientContact: dto.clientContact,
          clientAddress: dto.clientAddress,
          guestId: dto.guestId,
          reservationId: dto.reservationId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          departmentId: dto.departmentId,
          activityId: dto.activityId,
          costCenterId: dto.costCenterId,
        },
        include: FULL_INCLUDE,
      });
    });

    return toInvoiceResponse(updated);
  }

  // Numéro assigné à l'émission, pas à la création (un brouillon abandonné ne consomme pas de
  // numéro). Limite de concurrence documentée : pas de séquence Postgres dédiée cette phase,
  // collision détectée par @@unique([hotelId, invoiceNumber]), échoue proprement.
  async issue(id: string, requester: AuthenticatedUser) {
    const invoice = await this.findFullOrThrow(id);
    assertInScope(invoice.hotel.organizationId, invoice.hotelId, requester);
    if (invoice.status !== "DRAFT") {
      throw new BadRequestException("Seule une facture en brouillon peut être émise");
    }
    if (invoice.lines.length === 0) {
      throw new BadRequestException("La facture doit contenir au moins une ligne");
    }

    const year = new Date().getUTCFullYear();
    const prefix = `INV-${year}-`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.invoice.count({
        where: { hotelId: invoice.hotelId, invoiceNumber: { startsWith: prefix } },
      });
      const invoiceNumber = `${prefix}${String(existingCount + 1).padStart(4, "0")}`;
      return tx.invoice.update({
        where: { id },
        data: { status: "ISSUED", invoiceNumber, issueDate: new Date() },
        include: FULL_INCLUDE,
      });
    });

    return toInvoiceResponse(updated);
  }

  async cancel(id: string, requester: AuthenticatedUser) {
    const invoice = await this.findFullOrThrow(id);
    assertInScope(invoice.hotel.organizationId, invoice.hotelId, requester);
    if (invoice.status === "CANCELLED") {
      throw new BadRequestException("Cette facture est déjà annulée");
    }
    if (invoice.payments.length > 0 || invoice.creditNotes.length > 0) {
      throw new BadRequestException(
        "Impossible d'annuler une facture ayant des paiements ou avoirs enregistrés — utiliser un avoir"
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: FULL_INCLUDE,
    });
    return toInvoiceResponse(updated);
  }

  // Réutilisé par PaymentsService/CreditNotesService dans leur propre $transaction — jamais de
  // PATCH manuel vers PAID/PARTIALLY_PAID/ISSUED.
  async recalculateStatus(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lines: true, payments: true, creditNotes: true },
    });
    if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") {
      return;
    }
    const totals = computeInvoiceTotals(invoice.lines, invoice.payments, invoice.creditNotes);
    const hasSettlement = totals.amountPaid.plus(totals.amountCredited).greaterThan(0);
    const newStatus = totals.dueBalance.lessThanOrEqualTo(0) ? "PAID" : hasSettlement ? "PARTIALLY_PAID" : "ISSUED";
    if (newStatus !== invoice.status) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
    }
  }

  async findFullOrThrow(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { ...FULL_INCLUDE, hotel: true },
    });
    if (!invoice) {
      throw new NotFoundException("Facture introuvable");
    }
    return invoice;
  }

  private async validateReferences(
    hotelId: string,
    dto: Pick<
      CreateInvoiceDto | UpdateInvoiceDto,
      "categoryId" | "departmentId" | "activityId" | "costCenterId" | "guestId" | "reservationId"
    >
  ): Promise<void> {
    if (dto.categoryId) {
      const category = await this.prisma.financialCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category || category.hotelId !== hotelId) {
        throw new BadRequestException("Catégorie invalide");
      }
      if (category.type !== "REVENUE") {
        throw new BadRequestException("La catégorie doit être de type REVENUE");
      }
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || department.hotelId !== hotelId) {
        throw new BadRequestException("Département invalide");
      }
    }
    if (dto.activityId) {
      const activity = await this.prisma.departmentActivity.findUnique({
        where: { id: dto.activityId },
        include: { department: true },
      });
      if (!activity || activity.department.hotelId !== hotelId) {
        throw new BadRequestException("Activité invalide");
      }
    }
    if (dto.costCenterId) {
      const costCenter = await this.prisma.costCenter.findUnique({ where: { id: dto.costCenterId } });
      if (!costCenter || costCenter.hotelId !== hotelId) {
        throw new BadRequestException("Centre de coût invalide");
      }
    }
    if (dto.guestId) {
      const guest = await this.prisma.guest.findUnique({ where: { id: dto.guestId } });
      if (!guest || guest.hotelId !== hotelId) {
        throw new BadRequestException("Client invalide");
      }
    }
    if (dto.reservationId) {
      const reservation = await this.prisma.reservation.findUnique({ where: { id: dto.reservationId } });
      if (!reservation || reservation.hotelId !== hotelId) {
        throw new BadRequestException("Réservation invalide");
      }
    }
  }
}
