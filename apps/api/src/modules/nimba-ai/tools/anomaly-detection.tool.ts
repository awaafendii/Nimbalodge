import { Injectable } from "@nestjs/common";

import { AnomalyDetectionService } from "../../anomaly-detection/anomaly-detection.service";
import type { Anomaly } from "../../anomaly-detection/anomaly";
import { buildProvenance } from "../context/provenance";
import type { AiResponseEnvelope } from "../dto/ai-response-envelope";
import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import type { AiTool } from "./ai-tool.interface";

export interface AnomalyDetectionInput {
  dateFrom?: string;
  dateTo?: string;
}

export interface AnomalyDetectionMinimized {
  period: { from: string; to: string };
  anomalies: Anomaly[];
}

// Nimba AI (Étape 8). `requiredPermissions` volontairement VIDE : un scan d'anomalies couvre
// plusieurs domaines de permission différents (budget, trésorerie, stock, RH, audit), il n'existe
// donc pas UNE permission qui gate correctement ce Tool dans son ensemble. La vraie application
// RBAC se fait plus profond, par détecteur, dans AnomalyDetectionService.detectAnomalies() — un
// demandeur sans aucune des permissions couvertes obtient un tableau vide, jamais une erreur ni un
// contournement. `nimba-ai.use` (porte d'entrée, contrôleur) reste le seul filtre à ce niveau.
//
// Pas de DataMinimizer dédié : la forme `Anomaly` (voir anomaly-detection/anomaly.ts) est déjà la
// minimisation elle-même — chaque détecteur ne produit que des agrégats/compteurs/valeurs déjà
// calculés, jamais de liste nominative — il n'y a rien de plus à retirer ici.
@Injectable()
export class AnomalyDetectionTool implements AiTool<AnomalyDetectionInput, AiResponseEnvelope<AnomalyDetectionMinimized>> {
  readonly name = "anomaly-scan";
  readonly description =
    "Détecte les anomalies (budget, trésorerie, stock, RH, audit trail) auxquelles le demandeur a accès, sur une période donnée, à partir de règles et de seuils déterministes.";
  readonly requiredPermissions: string[] = [];

  constructor(private readonly anomalyDetectionService: AnomalyDetectionService) {}

  async execute(input: AnomalyDetectionInput, context: AiRequestContext): Promise<AiResponseEnvelope<AnomalyDetectionMinimized>> {
    const { dateFrom, dateTo } = resolvePeriod(input);
    const anomalies = await this.anomalyDetectionService.detectAnomalies(context.user, context.permissions, dateFrom, dateTo);
    const period = { from: dateFrom.toISOString(), to: dateTo.toISOString() };

    return {
      data: { period, anomalies },
      provenance: [buildProvenance("Nimba AI → Détection d'anomalies", { period })],
    };
  }
}

function resolvePeriod(input: AnomalyDetectionInput): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const dateFrom = input.dateFrom ? new Date(input.dateFrom) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dateTo = input.dateTo ? new Date(input.dateTo) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { dateFrom, dateTo };
}
