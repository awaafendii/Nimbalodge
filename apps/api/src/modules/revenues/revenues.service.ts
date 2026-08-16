import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateRevenueDto } from "./dto/create-revenue.dto";
import { toRevenueResponse } from "./dto/revenue-response.dto";

@Injectable()
export class RevenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const revenues = await this.prisma.revenue.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { date: "desc" },
    });
    return revenues.map(toRevenueResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const revenue = await this.findWithHotelOrThrow(id);
    assertInScope(revenue.hotel.organizationId, revenue.hotelId, requester);
    return toRevenueResponse(revenue);
  }

  // Recette sans statut (§12 ne décrit aucun cycle de vie) : créée directement "finale", la
  // transaction caisse/banque est postée dans le même $transaction, jamais différée.
  async create(dto: CreateRevenueDto, requester: AuthenticatedUser) {
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

    const hasCash = Boolean(dto.cashAccountId);
    const hasBank = Boolean(dto.bankAccountId);
    if (hasCash === hasBank) {
      throw new BadRequestException("Exactement un compte (caisse ou banque) doit être renseigné");
    }

    const category = await this.prisma.financialCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category || category.hotelId !== hotelId) {
      throw new BadRequestException("Catégorie invalide");
    }
    if (category.type !== "REVENUE") {
      throw new BadRequestException("La catégorie doit être de type REVENUE");
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
    if (hasCash) {
      const cashAccount = await this.prisma.cashAccount.findUnique({ where: { id: dto.cashAccountId } });
      if (!cashAccount || cashAccount.hotelId !== hotelId) {
        throw new BadRequestException("Caisse invalide");
      }
    }
    if (hasBank) {
      const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
      if (!bankAccount || bankAccount.hotelId !== hotelId) {
        throw new BadRequestException("Compte bancaire invalide");
      }
    }

    const revenue = await this.prisma.$transaction(async (tx) => {
      const created = await tx.revenue.create({
        data: {
          hotelId,
          departmentId: dto.departmentId,
          activityId: dto.activityId,
          costCenterId: dto.costCenterId,
          categoryId: dto.categoryId,
          amount: dto.amount,
          currency: dto.currency,
          date: dto.date ? new Date(dto.date) : undefined,
          paymentMethod: dto.paymentMethod,
          cashAccountId: dto.cashAccountId,
          bankAccountId: dto.bankAccountId,
          reference: dto.reference,
          attachmentReference: dto.attachmentReference,
          recordedById: requester.id,
        },
      });

      const label = `Recette — ${category.name}`;
      if (hasCash) {
        await tx.cashTransaction.create({
          data: {
            cashAccountId: dto.cashAccountId!,
            direction: "IN",
            amount: dto.amount,
            label,
            date: created.date,
            revenueId: created.id,
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
            revenueId: created.id,
            createdById: requester.id,
          },
        });
      }

      return created;
    });

    return toRevenueResponse(revenue);
  }

  private async findWithHotelOrThrow(id: string) {
    const revenue = await this.prisma.revenue.findUnique({ where: { id }, include: { hotel: true } });
    if (!revenue) {
      throw new NotFoundException("Recette introuvable");
    }
    return revenue;
  }
}
