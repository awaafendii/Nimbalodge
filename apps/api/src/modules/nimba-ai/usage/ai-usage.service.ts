import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../database/prisma.service";

export type AiUsageRequestType = "chat" | "insight" | "anomaly";
export type AiUsageStatus = "SUCCESS" | "FAILURE" | "DENIED";

export interface RecordAiUsageParams {
  organizationId: string;
  hotelId: string | null;
  userId: string;
  provider: string;
  model: string;
  requestType: AiUsageRequestType;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  status: AiUsageStatus;
}

// Distinct d'AuditService : AuditLog répond à "qui a demandé quoi" (sécurité/traçabilité),
// AiUsageLog répond à "combien ça coûte, combien de requêtes" (métering/quotas/facturation futurs).
// Écrit après CHAQUE tentative d'appel LLM par l'orchestrateur — y compris "DENIED" (refusé par
// RBAC avant tout appel réseau) et "FAILURE" (erreur fournisseur) — jamais seulement les succès,
// sinon un futur quota sous-évaluerait l'usage réel. Best-effort comme AuditService.record() : un
// échec d'écriture d'usage ne doit jamais faire échouer la vraie requête IA qu'il journalise.
@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAiUsageParams): Promise<void> {
    await this.prisma.aiUsageLog
      .create({
        data: {
          organizationId: params.organizationId,
          hotelId: params.hotelId,
          userId: params.userId,
          provider: params.provider,
          model: params.model,
          requestType: params.requestType,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          latencyMs: params.latencyMs,
          status: params.status,
        },
      })
      .catch(() => undefined);
  }
}
