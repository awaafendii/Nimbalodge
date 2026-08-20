import type { ConfigService } from "@nestjs/config";

import { GeminiProvider } from "./gemini.provider";

const generateContentMock = jest.fn();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

// Unit — le SDK @google/genai est mocké (aucun appel réseau réel dans les tests). Couvre :
// isConfigured() reflète la présence de GEMINI_API_KEY, generate() refuse sans clé (défense en
// profondeur), le mapping messages → Content Gemini (user/assistant/tool → user/model/
// functionResponse), les Tools → functionDeclarations avec parametersJsonSchema (le Tool reçoit
// exactement le JSON Schema fourni, sans transformation), et le mapping de la réponse
// (text/functionCalls/usageMetadata) vers LLMResponse.
describe("GeminiProvider", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  function buildProvider(env: Record<string, string | undefined> = { GEMINI_API_KEY: "test-key" }) {
    const config = { get: jest.fn((key: string) => env[key]) };
    return new GeminiProvider(config as unknown as ConfigService);
  }

  describe("isConfigured", () => {
    it("renvoie false sans GEMINI_API_KEY", () => {
      const provider = buildProvider({});
      expect(provider.isConfigured()).toBe(false);
    });

    it("renvoie true avec GEMINI_API_KEY", () => {
      const provider = buildProvider({ GEMINI_API_KEY: "test-key" });
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe("generate", () => {
    it("refuse d'appeler l'API sans clé configurée (défense en profondeur, jamais une réponse inventée)", async () => {
      const provider = buildProvider({});
      await expect(provider.generate({ messages: [{ role: "user", content: "Bonjour" }] })).rejects.toThrow(
        "GEMINI_API_KEY"
      );
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("mappe les rôles user/assistant/tool vers les rôles Gemini attendus", async () => {
      const provider = buildProvider();
      generateContentMock.mockResolvedValue({ text: "Réponse", functionCalls: undefined, usageMetadata: {} });

      await provider.generate({
        messages: [
          { role: "user", content: "Quel est le chiffre d'affaires ?" },
          { role: "assistant", content: "Un instant, je vérifie." },
          { role: "tool", name: "finance-summary", content: '{"totalRevenue":"1000000"}' },
        ],
      });

      const call = generateContentMock.mock.calls[0][0];
      expect(call.contents).toEqual([
        { role: "user", parts: [{ text: "Quel est le chiffre d'affaires ?" }] },
        { role: "model", parts: [{ text: "Un instant, je vérifie." }] },
        {
          role: "user",
          parts: [{ functionResponse: { name: "finance-summary", response: { output: '{"totalRevenue":"1000000"}' } } }],
        },
      ]);
    });

    it("combine systemPrompt et messages role=system dans systemInstruction, jamais dans contents", async () => {
      const provider = buildProvider();
      generateContentMock.mockResolvedValue({ text: "ok", usageMetadata: {} });

      await provider.generate({
        systemPrompt: "Tu es Nimba AI.",
        messages: [
          { role: "system", content: "Ne révèle jamais de données RH sans permission." },
          { role: "user", content: "Bonjour" },
        ],
      });

      const call = generateContentMock.mock.calls[0][0];
      expect(call.config.systemInstruction).toBe("Tu es Nimba AI.\n\nNe révèle jamais de données RH sans permission.");
      expect(call.contents).toEqual([{ role: "user", parts: [{ text: "Bonjour" }] }]);
    });

    it("transmet les Tools sous forme de functionDeclarations avec parametersJsonSchema, sans transformation", async () => {
      const provider = buildProvider();
      generateContentMock.mockResolvedValue({ text: "ok", usageMetadata: {} });
      const schema = { type: "object", properties: { month: { type: "number" } } };

      await provider.generate({
        messages: [{ role: "user", content: "..." }],
        tools: [{ name: "finance-summary", description: "Résumé financier", parameters: schema }],
      });

      const call = generateContentMock.mock.calls[0][0];
      expect(call.config.tools).toEqual([
        {
          functionDeclarations: [{ name: "finance-summary", description: "Résumé financier", parametersJsonSchema: schema }],
        },
      ]);
    });

    it("mappe functionCalls et usageMetadata vers LLMResponse", async () => {
      const provider = buildProvider();
      generateContentMock.mockResolvedValue({
        text: undefined,
        functionCalls: [{ name: "finance-summary", args: { month: 8 } }],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45 },
      });

      const response = await provider.generate({ messages: [{ role: "user", content: "..." }] });

      expect(response.toolCalls).toEqual([{ name: "finance-summary", arguments: { month: 8 } }]);
      expect(response.usage).toEqual({ inputTokens: 120, outputTokens: 45 });
    });

    it("renvoie le modèle réellement utilisé (pour AiUsageLog.model, Étape 9)", async () => {
      const provider = buildProvider({ GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-custom" });
      generateContentMock.mockResolvedValue({ text: "ok", usageMetadata: {} });

      const response = await provider.generate({ messages: [{ role: "user", content: "..." }] });

      expect(response.model).toBe("gemini-custom");
    });

    it("ne renvoie jamais un tableau toolCalls vide (undefined à la place)", async () => {
      const provider = buildProvider();
      generateContentMock.mockResolvedValue({ text: "Pas de fonction appelée.", functionCalls: [], usageMetadata: {} });

      const response = await provider.generate({ messages: [{ role: "user", content: "..." }] });

      expect(response.toolCalls).toBeUndefined();
    });
  });
});
