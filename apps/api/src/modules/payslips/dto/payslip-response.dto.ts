import { Prisma, type Payslip } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

// Calculé à la demande, jamais stocké — même principe que les totaux Invoice (Phase 6).
export function computeNetPay(payslip: Payslip): Decimal {
  return new Prisma.Decimal(payslip.baseSalary)
    .plus(payslip.bonuses)
    .plus(payslip.overtimeAmount)
    .minus(payslip.absenceDeduction)
    .minus(payslip.advances)
    .minus(payslip.deductions);
}

export function toPayslipResponse(payslip: Payslip) {
  return {
    id: payslip.id,
    hotelId: payslip.hotelId,
    employeeId: payslip.employeeId,
    periodYear: payslip.periodYear,
    periodMonth: payslip.periodMonth,
    baseSalary: payslip.baseSalary,
    bonuses: payslip.bonuses,
    overtimeAmount: payslip.overtimeAmount,
    absenceDeduction: payslip.absenceDeduction,
    advances: payslip.advances,
    deductions: payslip.deductions,
    currency: payslip.currency,
    status: payslip.status,
    expenseId: payslip.expenseId,
    paidAt: payslip.paidAt,
    createdById: payslip.createdById,
    netPay: computeNetPay(payslip),
    createdAt: payslip.createdAt,
  };
}
