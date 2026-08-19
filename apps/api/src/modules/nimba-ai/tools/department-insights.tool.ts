import { Injectable } from "@nestjs/common";

import { ReportsService } from "../../reports/reports.service";
import type { ReportFinancialQueryDto } from "../../reports/dto/report-financial-query.dto";
import { DepartmentInsightsMinimizer } from "../context/department-insights.minimizer";
import { buildProvenance } from "../context/provenance";
import type { AiResponseEnvelope } from "../dto/ai-response-envelope";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import type { AiTool } from "./ai-tool.interface";
import type { DepartmentComparisonMinimized } from "../context/department-insights.minimizer";

export interface DepartmentInsightsInput {
  dateFrom?: string;
  dateTo?: string;
}

// Nimba AI (Étape 4 — data access layer). Enveloppe ReportsService.financialReport() forcé sur
// groupBy="department" : le regroupement par département existe déjà (Phase 11), rien de neuf à
// recalculer. Les départements sont toujours ceux réellement configurés par l'hôtel du demandeur
// (financialReport les résout par ID réel, jamais par nom supposé) — jamais de Restaurant/Spa/Bar
// en dur ici ni ailleurs dans Nimba AI.
@Injectable()
export class DepartmentInsightsTool
  implements AiTool<DepartmentInsightsInput, AiResponseEnvelope<DepartmentComparisonMinimized>>
{
  readonly name = "department-comparison";
  readonly description =
    "Comparaison des recettes/dépenses/rentabilité par département de l'hôtel, sur une période donnée.";
  readonly requiredPermissions = ["reports.financial.view"];

  constructor(
    private readonly reportsService: ReportsService,
    private readonly minimizer: DepartmentInsightsMinimizer
  ) {}

  async execute(
    input: DepartmentInsightsInput,
    context: AiRequestContext
  ): Promise<AiResponseEnvelope<DepartmentComparisonMinimized>> {
    const query: ReportFinancialQueryDto = {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      groupBy: "department",
    };
    const raw = await this.reportsService.financialReport(query, context.user);
    const data = this.minimizer.minimize(raw);

    return {
      data,
      provenance: [buildProvenance("Finance → Rapport → Par département", { period: data.period })],
    };
  }
}
