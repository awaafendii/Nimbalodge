import { Prisma } from "@prisma/client";

import { HrPayrollMinimizer } from "./hr-payroll.minimizer";

describe("HrPayrollMinimizer", () => {
  it("ne renvoie que des agrégats -- total net et nombre de bulletins, jamais de détail individuel", () => {
    const minimizer = new HrPayrollMinimizer();

    const minimized = minimizer.minimize({
      current: { year: 2026, month: 8, totalNetPay: new Prisma.Decimal("5500000"), payslipCount: 10 },
      previous: { year: 2026, month: 7, totalNetPay: new Prisma.Decimal("5200000"), payslipCount: 9 },
    });

    expect(minimized).toEqual({
      current: { year: 2026, month: 8, totalNetPay: "5500000", payslipCount: 10 },
      previous: { year: 2026, month: 7, totalNetPay: "5200000", payslipCount: 9 },
    });
    // Aucune clé autre que year/month/totalNetPay/payslipCount ne doit jamais apparaître --
    // vérifié positivement ci-dessus (toEqual est strict sur la forme), pas seulement par absence.
  });
});
