import { BadRequestException, Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { InvoicesService } from "./invoices.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService
  ) {}

  async list(invoiceId: string, requester: AuthenticatedUser) {
    const invoice = await this.invoicesService.findFullOrThrow(invoiceId);
    assertInScope(invoice.hotel.organizationId, invoice.hotelId, requester);
    return this.prisma.payment.findMany({ where: { invoiceId }, orderBy: { date: "asc" } });
  }

  // Poste directement une transaction caisse/banque (IN) — AUCUNE ligne Revenue créée (voir
  // docs/architecture/phase-6-billing.md, décision 3).
  async create(invoiceId: string, dto: CreatePaymentDto, requester: AuthenticatedUser) {
    const invoice = await this.invoicesService.findFullOrThrow(invoiceId);
    assertInScope(invoice.hotel.organizationId, invoice.hotelId, requester);

    if (invoice.status !== "ISSUED" && invoice.status !== "PARTIALLY_PAID") {
      throw new BadRequestException("La facture doit être émise et non soldée pour recevoir un paiement");
    }

    const hasCash = Boolean(dto.cashAccountId);
    const hasBank = Boolean(dto.bankAccountId);
    if (hasCash === hasBank) {
      throw new BadRequestException("Exactement un compte (caisse ou banque) doit être renseigné");
    }

    if (hasCash) {
      const cashAccount = await this.prisma.cashAccount.findUnique({ where: { id: dto.cashAccountId } });
      if (!cashAccount || cashAccount.hotelId !== invoice.hotelId) {
        throw new BadRequestException("Caisse invalide");
      }
    }
    if (hasBank) {
      const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
      if (!bankAccount || bankAccount.hotelId !== invoice.hotelId) {
        throw new BadRequestException("Compte bancaire invalide");
      }
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          date: dto.date ? new Date(dto.date) : undefined,
          cashAccountId: dto.cashAccountId,
          bankAccountId: dto.bankAccountId,
          reference: dto.reference,
          createdById: requester.id,
        },
      });

      const label = `Paiement facture ${invoice.invoiceNumber ?? invoice.id}`;
      if (hasCash) {
        await tx.cashTransaction.create({
          data: {
            cashAccountId: dto.cashAccountId!,
            direction: "IN",
            amount: dto.amount,
            label,
            date: created.date,
            paymentId: created.id,
            createdById: requester.id,
          },
        });
      } else {
        await tx.bankTransaction.create({
          data: {
            bankAccountId: dto.bankAccountId!,
            direction: "IN",
            amount: dto.amount,
            label,
            date: created.date,
            paymentId: created.id,
            createdById: requester.id,
          },
        });
      }

      await this.invoicesService.recalculateStatus(tx, invoiceId);

      return created;
    });

    return payment;
  }
}
