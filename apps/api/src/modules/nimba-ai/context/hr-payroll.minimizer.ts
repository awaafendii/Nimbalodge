import { Injectable } from "@nestjs/common";

import type { PayrollSummaryRaw } from "../../hr-insights/hr-insights.service";
import type { DataMinimizer } from "./data-minimizer.interface";

export interface PayrollPeriodMinimized {
  year: number;
  month: number;
  totalNetPay: string;
  payslipCount: number;
}

export interface PayrollSummaryMinimized {
  current: PayrollPeriodMinimized;
  previous: PayrollPeriodMinimized;
}

// EXEMPLE DE MINIMISATION CANONIQUE (voir plan d'architecture Nimba AI) : la masse salariale ne
// transmet jamais que des agrégats — total net et nombre de bulletins — jamais un nom, un email,
// un matricule ou un montant individuel, même si HrInsightsService avait ces détails en mémoire
// pour calculer le total (il ne les sélectionne d'ailleurs jamais, voir
// HrInsightsService.computePayrollPeriod()).
@Injectable()
export class HrPayrollMinimizer implements DataMinimizer<PayrollSummaryRaw, PayrollSummaryMinimized> {
  minimize(raw: PayrollSummaryRaw): PayrollSummaryMinimized {
    return {
      current: this.minimizePeriod(raw.current),
      previous: this.minimizePeriod(raw.previous),
    };
  }

  private minimizePeriod(period: PayrollSummaryRaw["current"]): PayrollPeriodMinimized {
    return {
      year: period.year,
      month: period.month,
      totalNetPay: period.totalNetPay.toString(),
      payslipCount: period.payslipCount,
    };
  }
}
