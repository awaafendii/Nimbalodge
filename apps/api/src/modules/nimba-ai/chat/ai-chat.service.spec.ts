import { ForbiddenException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { ConversationProvider } from "../conversation/conversation-provider.interface";
import type { AiOrchestratorService, AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import type { LLMProvider } from "../providers/llm-provider.interface";
import type { AiTool } from "../tools/ai-tool.interface";
import type { AiToolRegistry } from "../tools/ai-tool-registry";
import type { AiUsageService } from "../usage/ai-usage.service";
import { AiChatService } from "./ai-chat.service";

// Unit — LLMProvider/AiToolRegistry/AiOrchestratorService/ConversationProvider/AiUsageService
// entièrement mockés (aucun appel réseau réel, voir FakeLLMProvider pour l'équivalent utilisable en
// e2e). Couvre : indisponibilité sans clé configurée, boucle de function-calling multi-tours,
// refus RBAC d'un Tool reformulé en message "tool" plutôt qu'en erreur qui casserait la
// conversation, échec fournisseur n'empêchant jamais une réponse structurée, et la limite
// d'itérations contre une boucle infinie.
describe("AiChatService", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };
  const context: AiRequestContext = { user, permissions: new Set(["finance-summary.view"]), departmentIds: [] };

  const financeTool: AiTool = {
    name: "finance-summary",
    description: "Résumé financier",
    requiredPermissions: ["finance-summary.view"],
    parameters: { type: "object", properties: {}, required: [] },
    execute: jest.fn(),
  };

  function buildService() {
    const llmProvider = { name: "gemini", isConfigured: jest.fn().mockReturnValue(true), generate: jest.fn() };
    const conversationProvider = {
      getHistory: jest.fn().mockResolvedValue([]),
      appendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const toolRegistry = { listAvailable: jest.fn().mockReturnValue([financeTool]) };
    const orchestrator = {
      resolveContext: jest.fn().mockResolvedValue(context),
      invokeTool: jest.fn(),
    };
    const usageService = { record: jest.fn().mockResolvedValue(undefined) };

    const service = new AiChatService(
      llmProvider as unknown as LLMProvider,
      conversationProvider as unknown as ConversationProvider,
      toolRegistry as unknown as AiToolRegistry,
      orchestrator as unknown as AiOrchestratorService,
      usageService as unknown as AiUsageService
    );

    return { service, llmProvider, conversationProvider, toolRegistry, orchestrator, usageService };
  }

  it("renvoie un message clair sans appeler le fournisseur si aucune clé n'est configurée (jamais une erreur, jamais une réponse inventée)", async () => {
    const { service, llmProvider, usageService } = buildService();
    llmProvider.isConfigured.mockReturnValue(false);

    const result = await service.chat("Quel est le chiffre d'affaires ?", "conv-1", undefined, user);

    expect(result.answer).toBeUndefined();
    expect(result.disclaimer).toContain("n'est pas configuré");
    expect(llmProvider.generate).not.toHaveBeenCalled();
    expect(usageService.record).not.toHaveBeenCalled();
  });

  it("répond directement quand le LLM ne demande aucun Tool", async () => {
    const { service, llmProvider, usageService } = buildService();
    llmProvider.generate.mockResolvedValue({ text: "Bonjour, comment puis-je vous aider ?", model: "gemini-3.6-flash", usage: { inputTokens: 10, outputTokens: 5 } });

    const result = await service.chat("Bonjour", "conv-1", undefined, user);

    expect(result.answer).toBe("Bonjour, comment puis-je vous aider ?");
    expect(result.toolResults).toEqual([]);
    expect(result.disclaimer).toBeUndefined();
    expect(usageService.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SUCCESS", requestType: "chat", model: "gemini-3.6-flash", inputTokens: 10, outputTokens: 5 })
    );
  });

  it("exécute un Tool via l'orchestrateur (jamais AiToolRegistry directement) puis reformule le résultat déjà calculé", async () => {
    const { service, llmProvider, orchestrator } = buildService();
    llmProvider.generate
      .mockResolvedValueOnce({ toolCalls: [{ name: "finance-summary", arguments: { month: 8 } }], model: "gemini-3.6-flash" })
      .mockResolvedValueOnce({ text: "Les recettes de ce mois sont de 750 000 GNF.", model: "gemini-3.6-flash" });
    orchestrator.invokeTool.mockResolvedValue({
      data: { totalRevenue: "750000" },
      provenance: [{ module: "Finance → Résumé" }],
    });

    const result = await service.chat("Quel est le chiffre d'affaires du mois ?", "conv-1", undefined, user);

    expect(orchestrator.invokeTool).toHaveBeenCalledWith("finance-summary", { month: 8 }, user);
    expect(result.answer).toBe("Les recettes de ce mois sont de 750 000 GNF.");
    expect(result.toolResults).toEqual([{ tool: "finance-summary", data: { totalRevenue: "750000" } }]);
    expect(result.provenance).toEqual([{ module: "Finance → Résumé" }]);
    expect(result.disclaimer).toContain("Synthèse générée par IA");
  });

  it("un refus RBAC sur un Tool devient un message pour le LLM, jamais une erreur qui casse la conversation", async () => {
    const { service, llmProvider, orchestrator } = buildService();
    llmProvider.generate
      .mockResolvedValueOnce({ toolCalls: [{ name: "hr-payroll-summary", arguments: {} }], model: "gemini-3.6-flash" })
      .mockResolvedValueOnce({ text: "Je n'ai pas accès à la masse salariale pour répondre à cette question.", model: "gemini-3.6-flash" });
    orchestrator.invokeTool.mockRejectedValue(new ForbiddenException("Permissions insuffisantes"));

    const result = await service.chat("Quel est le salaire total ?", "conv-1", undefined, user);

    expect(result.answer).toContain("pas accès");
    expect(result.toolResults).toEqual([]);
    const secondCallMessages = llmProvider.generate.mock.calls[1][0].messages;
    const toolMessage = secondCallMessages.find((m: { role: string }) => m.role === "tool");
    expect(toolMessage.content).toContain("Accès refusé");
  });

  it("une erreur du fournisseur LLM renvoie un disclaimer plutôt que de faire échouer la requête", async () => {
    const { service, llmProvider, usageService } = buildService();
    llmProvider.generate.mockRejectedValue(new Error("quota dépassé"));

    const result = await service.chat("Bonjour", "conv-1", undefined, user);

    expect(result.answer).toBeUndefined();
    expect(result.disclaimer).toContain("indisponible");
    expect(usageService.record).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILURE" }));
  });

  it("s'arrête après un nombre maximal d'itérations si le LLM ne cesse de demander des Tools", async () => {
    const { service, llmProvider, orchestrator } = buildService();
    llmProvider.generate.mockResolvedValue({ toolCalls: [{ name: "finance-summary", arguments: {} }], model: "gemini-3.6-flash" });
    orchestrator.invokeTool.mockResolvedValue({ data: {}, provenance: [] });

    const result = await service.chat("Question sans fin", "conv-1", undefined, user);

    expect(result.answer).toBeUndefined();
    expect(result.disclaimer).toContain("trop d'étapes");
    expect(llmProvider.generate.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("ne propose au LLM que les Tools déjà autorisés par le contexte résolu (listAvailable)", async () => {
    const { service, llmProvider, toolRegistry } = buildService();
    llmProvider.generate.mockResolvedValue({ text: "ok", model: "gemini-3.6-flash" });

    await service.chat("Bonjour", "conv-1", undefined, user);

    expect(toolRegistry.listAvailable).toHaveBeenCalledWith(context);
    const toolsPassed = llmProvider.generate.mock.calls[0][0].tools;
    expect(toolsPassed).toEqual([{ name: "finance-summary", description: "Résumé financier", parameters: financeTool.parameters }]);
  });
});
