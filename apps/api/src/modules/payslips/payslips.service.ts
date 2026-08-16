import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { CreatePayslipDto } from "./dto/create-payslip.dto";
import { MarkPaidPayslipDto } from "./dto/mark-paid-payslip.dto";
import { computeNetPay, toPayslipResponse } from "./dto/payslip-response.dto";
import { UpdatePayslipDto } from "./dto/update-payslip.dto";

@Injectable()
export class PayslipsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(requester: AuthenticatedUser) {
    const payslips = await this.prisma.payslip.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    return payslips.map(toPayslipResponse);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const payslip = await this.findWithHotelOrThrow(id);
    assertInScope(payslip.hotel.organizationId, payslip.hotelId, requester);
    return toPayslipResponse(payslip);
  }

  async create(dto: CreatePayslipDto, requester: AuthenticatedUser) {
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

    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.hotelId !== hotelId) {
      throw new BadRequestException("Employé invalide");
    }

    const existing = await this.prisma.payslip.findUnique({
      where: {
        hotelId_employeeId_periodYear_periodMonth: {
          hotelId,
          employeeId: dto.employeeId,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
        },
      },
    });
    if (existing) {
      throw new ConflictException("Un bulletin existe déjà pour cet employé sur cette période");
    }

    const payslip = await this.prisma.payslip.create({
      data: {
        hotelId,
        employeeId: dto.employeeId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        // Copie figée depuis Employee, jamais relue après (même principe qu'agreedRate/unitPrice).
        baseSalary: employee.baseSalary,
        bonuses: dto.bonuses,
        overtimeAmount: dto.overtimeAmount,
        absenceDeduction: dto.absenceDeduction,
        advances: dto.advances,
        deductions: dto.deductions,
        currency: dto.currency ?? employee.currency,
        createdById: requester.id,
      },
    });
    return toPayslipResponse(payslip);
  }

  async update(id: string, dto: UpdatePayslipDto, requester: AuthenticatedUser) {
    const payslip = await this.findWithHotelOrThrow(id);
    assertInScope(payslip.hotel.organizationId, payslip.hotelId, requester);
    if (payslip.status !== "DRAFT") {
      throw new BadRequestException("Seul un bulletin en brouillon peut être modifié");
    }

    const updated = await this.prisma.payslip.update({ where: { id }, data: dto });
    return toPayslipResponse(updated);
  }

  async finalize(id: string, requester: AuthenticatedUser) {
    const payslip = await this.findWithHotelOrThrow(id);
    assertInScope(payslip.hotel.organizationId, payslip.hotelId, requester);
    if (payslip.status !== "DRAFT") {
      throw new BadRequestException(
        `Impossible d'effectuer "finalize" depuis le statut ${payslip.status} (attendu : DRAFT)`
      );
    }
    const updated = await this.prisma.payslip.update({ where: { id }, data: { status: "FINALIZED" } });
    return toPayslipResponse(updated);
  }

  // Structure identique à ExpensesService.markPaid — crée une Expense directement au statut PAID
  // (le FINALIZED du Payslip représente déjà l'approbation RH) + la CashTransaction/BankTransaction
  // correspondante, dans un seul $transaction. "Alimente automatiquement Finance" (§22).
  async markPaid(id: string, dto: MarkPaidPayslipDto, requester: AuthenticatedUser) {
    const payslip = await this.findWithHotelOrThrow(id);
    assertInScope(payslip.hotel.organizationId, payslip.hotelId, requester);
    if (payslip.status !== "FINALIZED") {
      throw new BadRequestException(
        `Impossible d'effectuer "mark-paid" depuis le statut ${payslip.status} (attendu : FINALIZED)`
      );
    }

    const hasCash = Boolean(dto.cashAccountId);
    const hasBank = Boolean(dto.bankAccountId);
    if (hasCash === hasBank) {
      throw new BadRequestException("Exactement un compte (caisse ou banque) doit être renseigné");
    }

    const category = await this.prisma.financialCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category || category.hotelId !== payslip.hotelId) {
      throw new BadRequestException("Catégorie invalide");
    }
    if (category.type !== "EXPENSE") {
      throw new BadRequestException("La catégorie doit être de type EXPENSE");
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || department.hotelId !== payslip.hotelId) {
        throw new BadRequestException("Département invalide");
      }
    }
    if (dto.activityId) {
      const activity = await this.prisma.departmentActivity.findUnique({
        where: { id: dto.activityId },
        include: { department: true },
      });
      if (!activity || activity.department.hotelId !== payslip.hotelId) {
        throw new BadRequestException("Activité invalide");
      }
    }
    if (dto.costCenterId) {
      const costCenter = await this.prisma.costCenter.findUnique({ where: { id: dto.costCenterId } });
      if (!costCenter || costCenter.hotelId !== payslip.hotelId) {
        throw new BadRequestException("Centre de coût invalide");
      }
    }
    if (dto.cashAccountId) {
      const cashAccount = await this.prisma.cashAccount.findUnique({ where: { id: dto.cashAccountId } });
      if (!cashAccount || cashAccount.hotelId !== payslip.hotelId) {
        throw new BadRequestException("Caisse invalide");
      }
    }
    if (dto.bankAccountId) {
      const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
      if (!bankAccount || bankAccount.hotelId !== payslip.hotelId) {
        throw new BadRequestException("Compte bancaire invalide");
      }
    }

    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { id: payslip.employeeId } });
    const netPay = computeNetPay(payslip);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          hotelId: payslip.hotelId,
          departmentId: dto.departmentId,
          activityId: dto.activityId,
          costCenterId: dto.costCenterId,
          categoryId: dto.categoryId,
          amount: netPay,
          currency: payslip.currency,
          date: now,
          vendorName: `Paie — ${employee.firstName} ${employee.lastName}`,
          paymentMethod: dto.paymentMethod,
          cashAccountId: dto.cashAccountId,
          bankAccountId: dto.bankAccountId,
          reference: dto.reference,
          status: "PAID",
          requesterId: requester.id,
          validatorId: requester.id,
          validatedAt: now,
          paidAt: now,
        },
      });

      const label = `Paie — ${employee.firstName} ${employee.lastName}`;
      if (hasCash) {
        await tx.cashTransaction.create({
          data: {
            cashAccountId: dto.cashAccountId!,
            direction: "OUT",
            amount: netPay,
            label,
            date: now,
            expenseId: expense.id,
            createdById: requester.id,
          },
        });
      } else {
        await tx.bankTransaction.create({
          data: {
            bankAccountId: dto.bankAccountId!,
            direction: "OUT",
            amount: netPay,
            label,
            date: now,
            expenseId: expense.id,
            createdById: requester.id,
          },
        });
      }

      return tx.payslip.update({
        where: { id: payslip.id },
        data: { status: "PAID", expenseId: expense.id, paidAt: now },
      });
    });

    return toPayslipResponse(updated);
  }

  private async findWithHotelOrThrow(id: string) {
    const payslip = await this.prisma.payslip.findUnique({ where: { id }, include: { hotel: true } });
    if (!payslip) {
      throw new NotFoundException("Bulletin de paie introuvable");
    }
    return payslip;
  }
}
