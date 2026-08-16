import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Expense, ExpenseStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { toExpenseResponse } from "./dto/expense-response.dto";
import { RejectExpenseDto } from "./dto/reject-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

type ExpenseFields = CreateExpenseDto | UpdateExpenseDto;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const expenses = await this.prisma.expense.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { date: "desc" },
    });
    return expenses.map(toExpenseResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const expense = await this.findWithHotelOrThrow(id);
    assertInScope(expense.hotel.organizationId, expense.hotelId, requester);
    return toExpenseResponse(expense);
  }

  async create(dto: CreateExpenseDto, requester: AuthenticatedUser) {
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

    const expense = await this.prisma.expense.create({
      data: {
        hotelId,
        departmentId: dto.departmentId,
        activityId: dto.activityId,
        costCenterId: dto.costCenterId,
        categoryId: dto.categoryId!,
        amount: dto.amount!,
        currency: dto.currency,
        date: dto.date ? new Date(dto.date) : undefined,
        vendorName: dto.vendorName,
        supplierId: dto.supplierId,
        purchaseOrderId: dto.purchaseOrderId,
        paymentMethod: dto.paymentMethod!,
        cashAccountId: dto.cashAccountId,
        bankAccountId: dto.bankAccountId,
        reference: dto.reference,
        attachmentReference: dto.attachmentReference,
        requesterId: requester.id,
      },
    });
    return toExpenseResponse(expense);
  }

  async update(id: string, dto: UpdateExpenseDto, requester: AuthenticatedUser) {
    const expense = await this.findWithHotelOrThrow(id);
    assertInScope(expense.hotel.organizationId, expense.hotelId, requester);
    if (expense.status !== "DRAFT") {
      throw new BadRequestException("Seule une dépense en brouillon peut être modifiée");
    }

    await this.validateReferences(expense.hotelId, dto);

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
    return toExpenseResponse(updated);
  }

  async submit(id: string, requester: AuthenticatedUser) {
    const expense = await this.transition(id, requester, "DRAFT", "submit");
    const updated = await this.prisma.expense.update({ where: { id: expense.id }, data: { status: "PENDING" } });
    return toExpenseResponse(updated);
  }

  async approve(id: string, requester: AuthenticatedUser) {
    const expense = await this.transition(id, requester, "PENDING", "approve");
    const updated = await this.prisma.expense.update({
      where: { id: expense.id },
      data: { status: "APPROVED", validatorId: requester.id, validatedAt: new Date() },
    });
    return toExpenseResponse(updated);
  }

  async reject(id: string, dto: RejectExpenseDto, requester: AuthenticatedUser) {
    const expense = await this.transition(id, requester, "PENDING", "reject");
    const updated = await this.prisma.expense.update({
      where: { id: expense.id },
      data: { status: "REJECTED", validatorId: requester.id, validatedAt: new Date(), rejectionReason: dto.reason },
    });
    return toExpenseResponse(updated);
  }

  // Seul point du cycle de vie où une transaction caisse/banque est créée — jamais avant (§13, voir
  // docs/architecture/phase-5-finance.md).
  async markPaid(id: string, requester: AuthenticatedUser) {
    const expense = await this.transition(id, requester, "APPROVED", "mark-paid");

    const hasCash = Boolean(expense.cashAccountId);
    const hasBank = Boolean(expense.bankAccountId);
    if (hasCash === hasBank) {
      throw new BadRequestException(
        "La dépense doit avoir exactement un compte (caisse ou banque) renseigné avant paiement"
      );
    }

    const category = await this.prisma.financialCategory.findUniqueOrThrow({ where: { id: expense.categoryId } });

    const updated = await this.prisma.$transaction(async (tx) => {
      const paid = await tx.expense.update({
        where: { id: expense.id },
        data: { status: "PAID", paidAt: new Date() },
      });

      const label = `Dépense — ${category.name}`;
      if (hasCash) {
        await tx.cashTransaction.create({
          data: {
            cashAccountId: expense.cashAccountId!,
            direction: "OUT",
            amount: expense.amount,
            label,
            date: paid.paidAt!,
            expenseId: expense.id,
            createdById: requester.id,
          },
        });
      } else {
        await tx.bankTransaction.create({
          data: {
            bankAccountId: expense.bankAccountId!,
            direction: "OUT",
            amount: expense.amount,
            label,
            date: paid.paidAt!,
            expenseId: expense.id,
            createdById: requester.id,
          },
        });
      }

      return paid;
    });

    return toExpenseResponse(updated);
  }

  async book(id: string, requester: AuthenticatedUser) {
    const expense = await this.transition(id, requester, "PAID", "book");
    const updated = await this.prisma.expense.update({
      where: { id: expense.id },
      data: { status: "BOOKED", bookedAt: new Date() },
    });
    return toExpenseResponse(updated);
  }

  private async transition(
    id: string,
    requester: AuthenticatedUser,
    expectedStatus: ExpenseStatus,
    action: string
  ): Promise<Expense> {
    const expense = await this.findWithHotelOrThrow(id);
    assertInScope(expense.hotel.organizationId, expense.hotelId, requester);
    if (expense.status !== expectedStatus) {
      throw new BadRequestException(
        `Impossible d'effectuer "${action}" depuis le statut ${expense.status} (attendu : ${expectedStatus})`
      );
    }
    return expense;
  }

  private async validateReferences(hotelId: string, dto: ExpenseFields): Promise<void> {
    if (dto.categoryId) {
      const category = await this.prisma.financialCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category || category.hotelId !== hotelId) {
        throw new BadRequestException("Catégorie invalide");
      }
      if (category.type !== "EXPENSE") {
        throw new BadRequestException("La catégorie doit être de type EXPENSE");
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
    if (dto.cashAccountId) {
      const cashAccount = await this.prisma.cashAccount.findUnique({ where: { id: dto.cashAccountId } });
      if (!cashAccount || cashAccount.hotelId !== hotelId) {
        throw new BadRequestException("Caisse invalide");
      }
    }
    if (dto.bankAccountId) {
      const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
      if (!bankAccount || bankAccount.hotelId !== hotelId) {
        throw new BadRequestException("Compte bancaire invalide");
      }
    }
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier || supplier.hotelId !== hotelId) {
        throw new BadRequestException("Fournisseur invalide");
      }
    }
    if (dto.purchaseOrderId) {
      const purchaseOrder = await this.prisma.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId } });
      if (!purchaseOrder || purchaseOrder.hotelId !== hotelId) {
        throw new BadRequestException("Commande d'achat invalide");
      }
    }
  }

  private async findWithHotelOrThrow(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id }, include: { hotel: true } });
    if (!expense) {
      throw new NotFoundException("Dépense introuvable");
    }
    return expense;
  }
}
