import { Injectable } from "@nestjs/common";

import { FinanceSummaryService } from "../../finance-summary/finance-summary.service";
import { FinanceInsightsMinimizer } from "../context/finance-insights.minimizer";
import { buildProvenance } from "../context/provenance";
import type { AiResponseEnvelope } from "../dto/ai-response-envelope";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { PERIOD_MONTH_PARAMETERS, type AiTool } from "./ai-tool.interface";
import type { FinanceSummaryMinimized } from "../context/finance-insights.minimizer";

export interface FinanceInsightsInput {
  month?: number;
  year?: number;
}

// Nimba AI (Étape 4 — data access layer). Enveloppe FinanceSummaryService.getSummary() : aucune
// requête Prisma ici, le scope hôtel/organisation est appliqué par le service métier lui-même avec
// le vrai AuthenticatedUser transmis dans context.user. requiredPermissions = exactement la
// permission qui gate déjà GET /finance/summary — voir finance-summary.controller.ts.
@Injectable()
export class FinanceInsightsTool implements AiTool<FinanceInsightsInput, AiResponseEnvelope<FinanceSummaryMinimized>> {
  readonly name = "finance-summary";
  readonly description = "Résumé financier (recettes, dépenses, solde caisse/banque) pour une période donnée (mois/année).";
  readonly requiredPermissions = ["finance-summary.view"];
  readonly parameters = PERIOD_MONTH_PARAMETERS;

  constructor(
    private readonly financeSummaryService: FinanceSummaryService,
    private readonly minimizer: FinanceInsightsMinimizer
  ) {}

  async execute(
    input: FinanceInsightsInput,
    context: AiRequestContext
  ): Promise<AiResponseEnvelope<FinanceSummaryMinimized>> {
    const raw = await this.financeSummaryService.getSummary({ month: input.month, year: input.year }, context.user);
    const data = this.minimizer.minimize(raw);

    const monthStart = new Date(Date.UTC(data.period.year, data.period.month - 1, 1)).toISOString();
    const monthEnd = new Date(Date.UTC(data.period.year, data.period.month, 1)).toISOString();

    return {
      data,
      provenance: [buildProvenance("Finance → Résumé", { period: { from: monthStart, to: monthEnd } })],
    };
  }
}
