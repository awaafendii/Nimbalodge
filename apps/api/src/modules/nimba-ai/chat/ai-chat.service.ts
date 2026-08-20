import { Inject, Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { Provenance } from "../context/provenance";
import { CONVERSATION_PROVIDER_TOKEN, type ConversationProvider } from "../conversation/conversation-provider.interface";
import type { AiChatResponse, AiChatToolResult } from "../dto/ai-chat-response";
import type { AiResponseEnvelope } from "../dto/ai-response-envelope";
import { AiOrchestratorService } from "../orchestrator/ai-orchestrator.service";
import { LLM_PROVIDER_TOKEN, type LLMMessage, type LLMProvider, type LLMToolDefinition } from "../providers/llm-provider.interface";
import { AiToolRegistry } from "../tools/ai-tool-registry";
import { AiUsageService } from "../usage/ai-usage.service";

const SYSTEM_PROMPT =
  "Tu es Nimba AI, l'assistant intégré de NimbaLodge (ERP hôtelier). Tu réponds UNIQUEMENT à partir des données renvoyées par les outils mis à ta disposition (function calling) : tu n'inventes, ne devines et ne recalcules jamais toi-même un chiffre, un montant, un taux ou un pourcentage. Si les outils disponibles ne suffisent pas à répondre, dis-le clairement plutôt que de présenter une hypothèse comme un fait. Si un outil t'indique un refus d'accès, explique poliment que la question dépasse les permissions du demandeur, sans jamais tenter de la contourner. Réponds toujours en français, de façon concise et professionnelle.";

// Nombre maximal d'allers-retours LLM <-> Tools pour une seule question — protège contre une
// boucle infinie si le LLM continue de demander des outils sans jamais conclure.
const MAX_TOOL_ITERATIONS = 4;

// Nimba AI (Étape 9 — Assistant conversationnel). Distinct de la décision "pas de
// nimba-ai.service.ts intermédiaire" prise à l'Étape 7 : ce service n'est pas une couche de
// passthrough (le contrôleur ne pourrait pas se contenter d'appeler directement
// AiOrchestratorService.invokeTool ici) — il porte une vraie logique propre à la conversation
// (boucle de function-calling multi-tours, assemblage de l'historique, agrégation des résultats de
// plusieurs Tools). AiOrchestratorService reste le SEUL point de passage vers un Tool (via
// invokeTool, jamais AiToolRegistry directement) — même pipeline RBAC/scope/audit que pour
// Insights/Anomalies, le LLM ne fait jamais un tour sans que ce chemin soit respecté.
@Injectable()
export class AiChatService {
  constructor(
    @Inject(LLM_PROVIDER_TOKEN) private readonly llmProvider: LLMProvider,
    @Inject(CONVERSATION_PROVIDER_TOKEN) private readonly conversationProvider: ConversationProvider,
    private readonly toolRegistry: AiToolRegistry,
    private readonly orchestrator: AiOrchestratorService,
    private readonly usageService: AiUsageService
  ) {}

  async chat(
    message: string,
    conversationId: string,
    clientHistory: LLMMessage[] | undefined,
    user: AuthenticatedUser
  ): Promise<AiChatResponse> {
    // Matrice d'état de configuration (voir plan d'architecture Nimba AI) : Assistant indisponible
    // avec un message clair, jamais une erreur 500 ni une réponse inventée. Rien à journaliser dans
    // AiUsageLog ici — aucune tentative d'appel fournisseur n'a réellement eu lieu.
    if (!this.llmProvider.isConfigured()) {
      return {
        provenance: [],
        toolResults: [],
        disclaimer:
          "Nimba AI n'est pas configuré sur cet environnement (aucun fournisseur IA disponible). Les Insights et la détection d'anomalies déterministes restent disponibles.",
      };
    }

    const context = await this.orchestrator.resolveContext(user);
    const toolDefinitions: LLMToolDefinition[] = this.toolRegistry.listAvailable(context).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    const history = await this.conversationProvider.getHistory(conversationId, user, clientHistory);
    const userMessage: LLMMessage = { role: "user", content: message };
    await this.conversationProvider.appendMessage(conversationId, userMessage, user);
    const messages: LLMMessage[] = [...history, userMessage];

    const provenance: Provenance[] = [];
    const toolResults: AiChatToolResult[] = [];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const startedAt = Date.now();
      const response = await this.llmProvider
        .generate({ messages, tools: toolDefinitions.length > 0 ? toolDefinitions : undefined, systemPrompt: SYSTEM_PROMPT })
        .catch(() => null);

      if (!response) {
        await this.recordUsage(user, "FAILURE", Date.now() - startedAt);
        return {
          provenance,
          toolResults,
          disclaimer: "Le fournisseur IA est momentanément indisponible. Réessayez dans un instant.",
        };
      }
      await this.recordUsage(user, "SUCCESS", Date.now() - startedAt, response.model, response.usage);

      if (!response.toolCalls || response.toolCalls.length === 0) {
        await this.conversationProvider.appendMessage(conversationId, { role: "assistant", content: response.text ?? "" }, user);
        return {
          answer: response.text,
          provenance,
          toolResults,
          disclaimer:
            toolResults.length > 0
              ? "Synthèse générée par IA à partir des données ci-dessus — vérifiez les chiffres sources en cas de doute."
              : undefined,
        };
      }

      if (response.text) {
        messages.push({ role: "assistant", content: response.text });
      }

      for (const call of response.toolCalls) {
        try {
          // Seul chemin vers une donnée métier : mêmes permissions/scope/minimisation/audit que
          // /nimba-ai/insights/* et /nimba-ai/anomalies (Étapes 3/7/8) — un refus est déjà audité
          // par AiOrchestratorService.invokeTool (action "tool-denied"), jamais contourné ici.
          const result = await this.orchestrator.invokeTool<AiResponseEnvelope<unknown>>(call.name, call.arguments, user);
          provenance.push(...result.provenance);
          toolResults.push({ tool: call.name, data: result.data });
          messages.push({ role: "tool", name: call.name, content: JSON.stringify({ data: result.data, provenance: result.provenance }) });
        } catch {
          messages.push({
            role: "tool",
            name: call.name,
            content: JSON.stringify({ error: "Accès refusé ou outil indisponible pour cette question." }),
          });
        }
      }
    }

    return {
      provenance,
      toolResults,
      disclaimer: "Cette question nécessite trop d'étapes pour être traitée automatiquement. Essayez de la reformuler plus simplement.",
    };
  }

  private async recordUsage(
    user: AuthenticatedUser,
    status: "SUCCESS" | "FAILURE",
    latencyMs: number,
    model?: string,
    usage?: { inputTokens?: number; outputTokens?: number }
  ): Promise<void> {
    await this.usageService.record({
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      userId: user.id,
      provider: this.llmProvider.name,
      model: model ?? this.llmProvider.name,
      requestType: "chat",
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      latencyMs,
      status,
    });
  }
}
