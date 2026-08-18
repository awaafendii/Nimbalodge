import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { assertInDepartmentScope, assertInScope } from "../../common/utils/assert-in-scope";
import { PrismaService } from "../../database/prisma.service";
import { DepartmentsService } from "../departments/departments.service";
import { NotificationsService } from "../notifications/notifications.service";
import { toBudgetLineResponse, toBudgetResponse } from "./dto/budget-response.dto";
import { CreateBudgetLineDto } from "./dto/create-budget-line.dto";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly departmentsService: DepartmentsService
  ) {}

  async list(requester: AuthenticatedUser) {
    const budgets = await this.prisma.budget.findMany({
      where: requester.hotelId
        ? { hotelId: requester.hotelId }
        : { hotel: { organizationId: requester.organizationId } },
      orderBy: { createdAt: "asc" },
    });
    return budgets.map(toBudgetResponse);
  }

  // Étape 5 — Budget lui-même n'a pas de departmentId (c'est un conteneur hôtel partagé : un
  // même "Budget 2026" reçoit des lignes de plusieurs départements), donc contrairement à
  // Expense, le scope départemental ne restreint pas l'accès au budget lui-même — seulement aux
  // lignes qu'un demandeur départemental peut voir/agir dessus (le dimensionnement réel vit sur
  // BudgetLine). Un demandeur sans affectation (departmentIds vide) voit toutes les lignes,
  // comme avant.
  async findOne(id: string, requester: AuthenticatedUser) {
    const budget = await this.findWithHotelOrThrow(id);
    assertInScope(budget.hotel.organizationId, budget.hotelId, requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    const lines = await this.prisma.budgetLine.findMany({
      where: { budgetId: id, ...(departmentIds.length > 0 ? { departmentId: { in: departmentIds } } : {}) },
    });
    return { ...toBudgetResponse(budget), lines: lines.map(toBudgetLineResponse) };
  }

  async create(dto: CreateBudgetDto, requester: AuthenticatedUser) {
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

    const budget = await this.prisma.budget.create({
      data: {
        hotelId,
        name: dto.name,
        periodType: dto.periodType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
    return toBudgetResponse(budget);
  }

  async update(id: string, dto: UpdateBudgetDto, requester: AuthenticatedUser) {
    const budget = await this.findWithHotelOrThrow(id);
    assertInScope(budget.hotel.organizationId, budget.hotelId, requester);

    const updated = await this.prisma.budget.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
    return toBudgetResponse(updated);
  }

  async addLine(budgetId: string, dto: CreateBudgetLineDto, requester: AuthenticatedUser) {
    const budget = await this.findWithHotelOrThrow(budgetId);
    assertInScope(budget.hotel.organizationId, budget.hotelId, requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    assertInDepartmentScope(dto.departmentId ?? null, departmentIds);

    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || department.hotelId !== budget.hotelId) {
        throw new BadRequestException("Département invalide");
      }
    }
    if (dto.activityId) {
      const activity = await this.prisma.departmentActivity.findUnique({
        where: { id: dto.activityId },
        include: { department: true },
      });
      if (!activity || activity.department.hotelId !== budget.hotelId) {
        throw new BadRequestException("Activité invalide");
      }
    }
    if (dto.costCenterId) {
      const costCenter = await this.prisma.costCenter.findUnique({ where: { id: dto.costCenterId } });
      if (!costCenter || costCenter.hotelId !== budget.hotelId) {
        throw new BadRequestException("Centre de coût invalide");
      }
    }
    if (dto.categoryId) {
      const category = await this.prisma.financialCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category || category.hotelId !== budget.hotelId) {
        throw new BadRequestException("Catégorie invalide");
      }
      if (category.type !== dto.type) {
        throw new BadRequestException("Le type de la catégorie ne correspond pas au type de la ligne");
      }
    }

    const line = await this.prisma.budgetLine.create({
      data: {
        budgetId,
        type: dto.type,
        departmentId: dto.departmentId,
        activityId: dto.activityId,
        costCenterId: dto.costCenterId,
        categoryId: dto.categoryId,
        plannedAmount: dto.plannedAmount,
      },
    });
    return toBudgetLineResponse(line);
  }

  // Prévu/Réalisé/Écart/Taux calculés à la demande, jamais stockés (voir
  // docs/architecture/phase-5-finance.md) — agrège Expense (PAID/BOOKED uniquement) ou Revenue
  // selon `line.type`, filtré par les dimensions non-nulles de la ligne + la période du budget.
  async getExecution(budgetId: string, requester: AuthenticatedUser) {
    const budget = await this.findWithHotelOrThrow(budgetId);
    assertInScope(budget.hotel.organizationId, budget.hotelId, requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);

    const lines = await this.prisma.budgetLine.findMany({
      where: { budgetId, ...(departmentIds.length > 0 ? { departmentId: { in: departmentIds } } : {}) },
    });

    const results = await Promise.all(
      lines.map(async (line) => {
        const where: Record<string, unknown> = {
          hotelId: budget.hotelId,
          date: { gte: budget.startDate, lte: budget.endDate },
        };
        if (line.departmentId) where.departmentId = line.departmentId;
        if (line.activityId) where.activityId = line.activityId;
        if (line.costCenterId) where.costCenterId = line.costCenterId;
        if (line.categoryId) where.categoryId = line.categoryId;

        const actual =
          line.type === "EXPENSE"
            ? (
                await this.prisma.expense.aggregate({
                  where: { ...where, status: { in: ["PAID", "BOOKED"] } },
                  _sum: { amount: true },
                })
              )._sum.amount ?? new Prisma.Decimal(0)
            : (await this.prisma.revenue.aggregate({ where, _sum: { amount: true } }))._sum.amount ??
              new Prisma.Decimal(0);

        const planned = line.plannedAmount;
        const variance = planned.minus(actual);
        const executionRate = planned.isZero() ? new Prisma.Decimal(0) : actual.dividedBy(planned).times(100);

        return {
          lineId: line.id,
          type: line.type,
          departmentId: line.departmentId,
          activityId: line.activityId,
          costCenterId: line.costCenterId,
          categoryId: line.categoryId,
          planned,
          actual,
          variance,
          executionRate,
        };
      })
    );

    return { budgetId, startDate: budget.startDate, endDate: budget.endDate, lines: results };
  }

  // "Alertes de dépassement budgétaire" (Phase 5, prévu pour Phase 12 — "données déjà
  // interrogeables"). Déclenchement à la demande (pas de scheduler dans ce projet, aucune
  // infrastructure cron établie) : réutilise getExecution() telle quelle, ne recalcule rien —
  // hérite donc aussi de son filtrage départemental (Étape 5) : un responsable de département
  // ne déclenche des alertes que sur les lignes de son propre département, jamais sur celles des
  // autres départements du même budget.
  // Seules les lignes EXPENSE comptent (un dépassement REVENUE est une bonne nouvelle, pas une
  // alerte). Fan-out + déduplication délégués à NotificationsService.notifyUsersWithPermission()
  // (relatedType="budget_line" — une alerte par ligne en dépassement, jamais répétée une fois
  // créée, même si le dépassement s'aggrave ensuite : limite documentée).
  async checkOverspendAlerts(id: string, requester: AuthenticatedUser) {
    const budget = await this.findWithHotelOrThrow(id);
    assertInScope(budget.hotel.organizationId, budget.hotelId, requester);

    const execution = await this.getExecution(id, requester);
    const overspentLines = execution.lines.filter((line) => line.type === "EXPENSE" && line.actual.greaterThan(line.planned));

    let notificationsCreated = 0;
    for (const line of overspentLines) {
      notificationsCreated += await this.notificationsService.notifyUsersWithPermission({
        hotelId: budget.hotelId,
        organizationId: budget.hotel.organizationId,
        permissionKey: "finance-budgets.view",
        type: "budget_overspend",
        title: `Budget "${budget.name}" dépassé`,
        message: `Une ligne de "${budget.name}" dépasse le montant prévu : réalisé ${line.actual.toString()} pour un prévu de ${line.planned.toString()}.`,
        link: `/budgets/${budget.id}`,
        relatedType: "budget_line",
        relatedId: line.lineId,
      });
    }

    return { overspentLineCount: overspentLines.length, notificationsCreated };
  }

  private async findWithHotelOrThrow(id: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id }, include: { hotel: true } });
    if (!budget) {
      throw new NotFoundException("Budget introuvable");
    }
    return budget;
  }
}
