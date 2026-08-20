import { Injectable } from "@nestjs/common";

import { HrInsightsService } from "../../hr-insights/hr-insights.service";
import { buildProvenance } from "../context/provenance";
import { HrWorkforceMinimizer } from "../context/hr-workforce.minimizer";
import type { AiResponseEnvelope } from "../dto/ai-response-envelope";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import type { AiTool } from "./ai-tool.interface";
import type { WorkforceSummaryMinimized } from "../context/hr-workforce.minimizer";

export interface HrWorkforceInput {
  dateFrom?: string;
  dateTo?: string;
}

// Nimba AI (Étape 7). Effectifs, absentéisme, congés — jamais la masse salariale (voir
// HrPayrollTool, permission distincte payslips.view). Gardé par employees.view : la visibilité RH
// courante, pas la donnée salariale.
@Injectable()
export class HrWorkforceTool implements AiTool<HrWorkforceInput, AiResponseEnvelope<WorkforceSummaryMinimized>> {
  readonly name = "hr-workforce-summary";
  readonly description = "Effectifs, absentéisme et demandes de congé par statut pour une période donnée.";
  readonly requiredPermissions = ["employees.view"];

  constructor(
    private readonly hrInsightsService: HrInsightsService,
    private readonly minimizer: HrWorkforceMinimizer
  ) {}

  async execute(input: HrWorkforceInput, context: AiRequestContext): Promise<AiResponseEnvelope<WorkforceSummaryMinimized>> {
    const raw = await this.hrInsightsService.getWorkforceSummary(input, context.user);
    const data = this.minimizer.minimize(raw);

    return {
      data,
      provenance: [buildProvenance("RH → Effectifs & présence", { period: data.period })],
    };
  }
}
