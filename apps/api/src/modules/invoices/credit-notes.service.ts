import { BadRequestException, Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { CreateCreditNoteDto } from "./dto/create-credit-note.dto";
import { InvoicesService } from "./invoices.service";

@Injectable()
export class CreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService
  ) {}

  async list(invoiceId: string, requester: AuthenticatedUser) {
    const invoice = await this.invoicesService.findFullOrThrow(invoiceId);
    this.invoicesService.assertInScope(invoice.hotel.organizationId, invoice.hotelId, requester);
    return this.prisma.creditNote.findMany({ where: { invoiceId }, orderBy: { date: "asc" } });
  }

  // Remboursement optionnel : compte renseigné → transaction OUT postée (argent réellement
  // rendu) ; sinon l'avoir réduit seulement le solde dû sur papier.
  async create(invoiceId: string, dto: CreateCreditNoteDto, requester: AuthenticatedUser) {
    const invoice = await this.invoicesService.findFullOrThrow(invoiceId);
    this.invoicesService.assertInScope(invoice.hotel.organizationId, invoice.hotelId, requester);

    if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
      throw new BadRequestException("Un avoir ne peut être émis que sur une facture émise");
    }

    const hasCash = Boolean(dto.cashAccountId);
    const hasBank = Boolean(dto.bankAccountId);
    if (hasCash && hasBank) {
      throw new BadRequestException("Au plus un compte (caisse ou banque) peut être renseigné pour le remboursement");
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

    const creditNote = await this.prisma.$transaction(async (tx) => {
      const created = await tx.creditNote.create({
        data: {
          invoiceId,
          amount: dto.amount,
          reason: dto.reason,
          date: dto.date ? new Date(dto.date) : undefined,
          cashAccountId: dto.cashAccountId,
          bankAccountId: dto.bankAccountId,
          createdById: requester.id,
        },
      });

      if (hasCash || hasBank) {
        const label = `Avoir facture ${invoice.invoiceNumber ?? invoice.id}`;
        if (hasCash) {
          await tx.cashTransaction.create({
            data: {
              cashAccountId: dto.cashAccountId!,
              direction: "OUT",
              amount: dto.amount,
              label,
              date: created.date,
              creditNoteId: created.id,
              createdById: requester.id,
            },
          });
        } else {
          await tx.bankTransaction.create({
            data: {
              bankAccountId: dto.bankAccountId!,
              direction: "OUT",
              amount: dto.amount,
              label,
              date: created.date,
              creditNoteId: created.id,
              createdById: requester.id,
            },
          });
        }
      }

      await this.invoicesService.recalculateStatus(tx, invoiceId);

      return created;
    });

    return creditNote;
  }
}
