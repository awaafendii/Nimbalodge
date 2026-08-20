import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, type LeaveStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { DepartmentsService } from "../departments/departments.service";
import { computeNetPay } from "../payslips/dto/payslip-response.dto";

export interface HrInsightsQuery {
  dateFrom?: string;
  dateTo?: string;
}

export interface WorkforceSummaryRaw {
  period: { dateFrom: Date; dateTo: Date };
  headcount: number;
  scheduledShifts: number;
  attendedShifts: number;
  // null (jamais 0) quand aucun poste n'était planifié sur la période — "0% d'absentéisme" serait
  // un fait mesuré, "aucune donnée" ne l'est pas.
  absenteeismRate: number | null;
  leaveRequestsByStatus: Partial<Record<LeaveStatus, number>>;
}

interface PayrollPeriod {
  year: number;
  month: number;
  totalNetPay: Prisma.Decimal;
  payslipCount: number;
}

export interface PayrollSummaryRaw {
  current: PayrollPeriod;
  previous: PayrollPeriod;
}

// Nimba AI (Étape 7) — aucune agrégation RH n'existait avant cette étape (confirmé par recherche
// préalable) : deux méthodes distinctes plutôt qu'une seule "tout RH", pour que chaque capacité
// soit gardée par sa propre permission au niveau Tool (employees.view pour l'effectif/
// absentéisme/congés — visibilité RH courante ; payslips.view séparément pour la masse salariale —
// donnée salariale, plus sensible, exactement l'exemple du brief : un responsable Restaurant avec
// employees.view mais pas payslips.view ne doit jamais obtenir le coût de la paie). Scope
// département identique à EmployeesService/AttendanceService/PayslipsService (additif, opt-in —
// aucune affectation département = aucune restriction).
@Injectable()
export class HrInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService
  ) {}

  async getWorkforceSummary(query: HrInsightsQuery, requester: AuthenticatedUser): Promise<WorkforceSummaryRaw> {
    const { dateFrom, dateTo } = resolvePeriod(query);
    const hotelWhere = buildHotelWhere(requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    const employeeDeptFilter = departmentIds.length > 0 ? { departmentId: { in: departmentIds } } : {};
    const viaEmployeeDeptFilter = departmentIds.length > 0 ? { employee: { departmentId: { in: departmentIds } } } : {};

    const [headcount, scheduledShifts, attendances, leaveGroups] = await Promise.all([
      this.prisma.employee.count({ where: { ...hotelWhere, ...employeeDeptFilter, isActive: true } }),
      this.prisma.workSchedule.findMany({
        where: { ...hotelWhere, ...viaEmployeeDeptFilter, startAt: { gte: dateFrom, lt: dateTo } },
        select: { employeeId: true, startAt: true, endAt: true },
      }),
      this.prisma.attendance.findMany({
        where: { ...hotelWhere, ...viaEmployeeDeptFilter, clockIn: { gte: dateFrom, lt: dateTo } },
        select: { employeeId: true, clockIn: true },
      }),
      this.prisma.leaveRequest.groupBy({
        by: ["status"],
        where: { ...hotelWhere, ...viaEmployeeDeptFilter, startDate: { gte: dateFrom, lt: dateTo } },
        _count: { _all: true },
      }),
    ]);

    // Poste "honoré" : un pointage de l'employé planifié existe pendant sa plage horaire prévue.
    // Faute d'un lien direct WorkSchedule -> Attendance dans le schéma, c'est la meilleure
    // approximation disponible avec les données réellement saisies par les utilisateurs.
    const attendedShifts = scheduledShifts.filter((shift) =>
      attendances.some(
        (attendance) =>
          attendance.employeeId === shift.employeeId &&
          attendance.clockIn >= shift.startAt &&
          attendance.clockIn <= shift.endAt
      )
    ).length;

    const leaveRequestsByStatus: Partial<Record<LeaveStatus, number>> = {};
    for (const group of leaveGroups) {
      leaveRequestsByStatus[group.status] = group._count._all;
    }

    return {
      period: { dateFrom, dateTo },
      headcount,
      scheduledShifts: scheduledShifts.length,
      attendedShifts,
      absenteeismRate: scheduledShifts.length > 0 ? (scheduledShifts.length - attendedShifts) / scheduledShifts.length : null,
      leaveRequestsByStatus,
    };
  }

  async getPayrollSummary(query: HrInsightsQuery, requester: AuthenticatedUser): Promise<PayrollSummaryRaw> {
    const { dateFrom } = resolvePeriod(query);
    const year = dateFrom.getUTCFullYear();
    const month = dateFrom.getUTCMonth() + 1;
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;

    const [current, previous] = await Promise.all([
      this.computePayrollPeriod(year, month, requester),
      this.computePayrollPeriod(previousYear, previousMonth, requester),
    ]);

    return { current, previous };
  }

  private async computePayrollPeriod(year: number, month: number, requester: AuthenticatedUser): Promise<PayrollPeriod> {
    const hotelWhere = buildHotelWhere(requester);
    const departmentIds = await this.departmentsService.getDepartmentIds(requester.id);
    const viaEmployeeDeptFilter = departmentIds.length > 0 ? { employee: { departmentId: { in: departmentIds } } } : {};

    // Seuls les bulletins finalisés/payés comptent comme coût réel — un brouillon (DRAFT) n'est
    // pas encore un engagement définitif, même principe que Expense (PAID/BOOKED uniquement) dans
    // FinanceSummaryService.
    const payslips = await this.prisma.payslip.findMany({
      where: { ...hotelWhere, ...viaEmployeeDeptFilter, periodYear: year, periodMonth: month, status: { in: ["FINALIZED", "PAID"] } },
    });

    const totalNetPay = payslips.reduce((sum, payslip) => sum.plus(computeNetPay(payslip)), new Prisma.Decimal(0));
    return { year, month, totalNetPay, payslipCount: payslips.length };
  }
}

function buildHotelWhere(requester: AuthenticatedUser) {
  return requester.hotelId ? { hotelId: requester.hotelId } : { hotel: { organizationId: requester.organizationId } };
}

function resolvePeriod(query: HrInsightsQuery): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const dateFrom = query.dateFrom
    ? new Date(query.dateFrom)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dateTo = query.dateTo
    ? new Date(query.dateTo)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  if (dateFrom >= dateTo) {
    throw new BadRequestException("dateFrom doit être antérieure à dateTo");
  }
  return { dateFrom, dateTo };
}
