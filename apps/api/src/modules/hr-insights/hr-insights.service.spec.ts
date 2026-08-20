import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { DepartmentsService } from "../departments/departments.service";
import type { PrismaService } from "../../database/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { HrInsightsService } from "./hr-insights.service";

describe("HrInsightsService", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const dateFrom = "2026-08-01T00:00:00.000Z";
  const dateTo = "2026-09-01T00:00:00.000Z";

  function buildService(departmentIds: string[] = []) {
    const prisma = {
      employee: { count: jest.fn() },
      workSchedule: { findMany: jest.fn() },
      attendance: { findMany: jest.fn() },
      leaveRequest: { groupBy: jest.fn() },
      payslip: { findMany: jest.fn() },
    };
    const departmentsService = { getDepartmentIds: jest.fn().mockResolvedValue(departmentIds) };
    const service = new HrInsightsService(prisma as unknown as PrismaService, departmentsService as unknown as DepartmentsService);
    return { service, prisma, departmentsService };
  }

  describe("getWorkforceSummary", () => {
    it("rejette dateFrom >= dateTo", async () => {
      const { service } = buildService();
      await expect(service.getWorkforceSummary({ dateFrom: dateTo, dateTo: dateFrom }, user)).rejects.toThrow(
        BadRequestException
      );
    });

    it("calcule l'absentéisme : postes planifiés sans pointage correspondant comptent comme absence", async () => {
      const { service, prisma } = buildService();
      prisma.employee.count.mockResolvedValue(5);
      prisma.workSchedule.findMany.mockResolvedValue([
        { employeeId: "emp-1", startAt: new Date("2026-08-05T08:00:00Z"), endAt: new Date("2026-08-05T16:00:00Z") },
        { employeeId: "emp-2", startAt: new Date("2026-08-05T08:00:00Z"), endAt: new Date("2026-08-05T16:00:00Z") },
      ]);
      // emp-1 a bien pointé pendant son créneau ; emp-2 n'a aucun pointage correspondant.
      prisma.attendance.findMany.mockResolvedValue([{ employeeId: "emp-1", clockIn: new Date("2026-08-05T08:05:00Z") }]);
      prisma.leaveRequest.groupBy.mockResolvedValue([]);

      const result = await service.getWorkforceSummary({ dateFrom, dateTo }, user);

      expect(result.headcount).toBe(5);
      expect(result.scheduledShifts).toBe(2);
      expect(result.attendedShifts).toBe(1);
      expect(result.absenteeismRate).toBeCloseTo(0.5);
    });

    it("renvoie absenteeismRate=null (jamais 0) quand aucun poste n'était planifié", async () => {
      const { service, prisma } = buildService();
      prisma.employee.count.mockResolvedValue(3);
      prisma.workSchedule.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);
      prisma.leaveRequest.groupBy.mockResolvedValue([]);

      const result = await service.getWorkforceSummary({ dateFrom, dateTo }, user);

      expect(result.absenteeismRate).toBeNull();
    });

    it("applique le scope département (additif) quand le demandeur a des affectations", async () => {
      const { service, prisma } = buildService(["dept-1", "dept-2"]);
      prisma.employee.count.mockResolvedValue(2);
      prisma.workSchedule.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);
      prisma.leaveRequest.groupBy.mockResolvedValue([]);

      await service.getWorkforceSummary({ dateFrom, dateTo }, user);

      expect(prisma.employee.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ departmentId: { in: ["dept-1", "dept-2"] } }) })
      );
      expect(prisma.workSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employee: { departmentId: { in: ["dept-1", "dept-2"] } } }),
        })
      );
    });

    it("expose les demandes de congé par statut", async () => {
      const { service, prisma } = buildService();
      prisma.employee.count.mockResolvedValue(0);
      prisma.workSchedule.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);
      prisma.leaveRequest.groupBy.mockResolvedValue([
        { status: "APPROVED", _count: { _all: 4 } },
        { status: "PENDING", _count: { _all: 2 } },
      ]);

      const result = await service.getWorkforceSummary({ dateFrom, dateTo }, user);

      expect(result.leaveRequestsByStatus).toEqual({ APPROVED: 4, PENDING: 2 });
    });
  });

  describe("getPayrollSummary", () => {
    function payslip(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        baseSalary: new Prisma.Decimal("500000"),
        bonuses: new Prisma.Decimal("50000"),
        overtimeAmount: new Prisma.Decimal("0"),
        absenceDeduction: new Prisma.Decimal("0"),
        advances: new Prisma.Decimal("0"),
        deductions: new Prisma.Decimal("0"),
        status: "PAID",
        ...overrides,
      };
    }

    it("additionne le net à payer (via la même formule que le module Paie) pour les bulletins finalisés/payés uniquement", async () => {
      const { service, prisma } = buildService();
      prisma.payslip.findMany.mockResolvedValue([payslip(), payslip({ baseSalary: new Prisma.Decimal("300000") })]);

      const result = await service.getPayrollSummary({ dateFrom, dateTo }, user);

      expect(result.current.totalNetPay.toString()).toBe("900000"); // (500000+50000) + (300000+50000)
      expect(result.current.payslipCount).toBe(2);
      // Le filtre status IN [FINALIZED, PAID] est passé à Prisma -- vérifié via l'appel, pas
      // re-simulé ici (déjà le rôle de Prisma, pas de ce service).
      expect(prisma.payslip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: { in: ["FINALIZED", "PAID"] } }) })
      );
    });

    it("compare toujours au mois précédent, y compris le passage décembre → janvier", async () => {
      const { service, prisma } = buildService();
      prisma.payslip.findMany.mockResolvedValue([]);

      await service.getPayrollSummary({ dateFrom: "2026-01-01T00:00:00.000Z", dateTo: "2026-02-01T00:00:00.000Z" }, user);

      const calls = prisma.payslip.findMany.mock.calls;
      const periods = calls.map((call: [{ where: { periodYear: number; periodMonth: number } }]) => ({
        year: call[0].where.periodYear,
        month: call[0].where.periodMonth,
      }));
      expect(periods).toContainEqual({ year: 2026, month: 1 });
      expect(periods).toContainEqual({ year: 2025, month: 12 });
    });
  });
});
