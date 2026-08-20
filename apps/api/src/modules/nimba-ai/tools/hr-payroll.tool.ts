import { Injectable } from "@nestjs/common";

import { HrInsightsService } from "../../hr-insights/hr-insights.service";
import { buildProvenance } from "../context/provenance";
import { HrPayrollMinimizer } from "../context/hr-payroll.minimizer";
import type { AiResponseEnvelope } from "../dto/ai-response-envelope";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { PERIOD_RANGE_PARAMETERS, type AiTool } from "./ai-tool.interface";
import type { PayrollSummaryMinimized } from "../context/hr-payroll.minimizer";

export interface HrPayrollInput {
  dateFrom?: string;
  dateTo?: string;
}

// Nimba AI (Étape 7). Masse salariale (rejeu exact de l'exemple du brief) — Tool séparé de
// HrWorkforceTool précisément pour que payslips.view (donnée salariale sensible) gate cette
// capacité indépendamment de employees.view (visibilité RH courante). Un responsable Restaurant
// avec l'une mais pas l'autre obtient l'effectif sans jamais obtenir le coût de la paie.
@Injectable()
export class HrPayrollTool implements AiTool<HrPayrollInput, AiResponseEnvelope<PayrollSummaryMinimized>> {
  readonly name = "hr-payroll-summary";
  readonly description = "Masse salariale (net à payer total, bulletins finalisés/payés) pour un mois, avec comparaison au mois précédent.";
  readonly requiredPermissions = ["payslips.view"];
  readonly parameters = PERIOD_RANGE_PARAMETERS;

  constructor(
    private readonly hrInsightsService: HrInsightsService,
    private readonly minimizer: HrPayrollMinimizer
  ) {}

  async execute(input: HrPayrollInput, context: AiRequestContext): Promise<AiResponseEnvelope<PayrollSummaryMinimized>> {
    const raw = await this.hrInsightsService.getPayrollSummary(input, context.user);
    const data = this.minimizer.minimize(raw);

    return {
      data,
      provenance: [
        buildProvenance("RH → Masse salariale", {
          filters: { year: String(data.current.year), month: String(data.current.month) },
        }),
      ],
    };
  }
}
