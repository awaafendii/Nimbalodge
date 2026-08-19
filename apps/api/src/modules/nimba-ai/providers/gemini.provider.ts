import { GoogleGenAI, type Content } from "@google/genai";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type {
  LLMGenerateParams,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMToolCall,
} from "./llm-provider.interface";

// Vérifié en direct contre la vraie API (Étape 6) : gemini-2.0-flash est retiré ("no longer
// available", 404 — l'API recommande explicitement ce modèle en remplacement). Reste configurable
// via GEMINI_MODEL si Google fait à nouveau évoluer la gamme de modèles disponibles.
const DEFAULT_MODEL = "gemini-3.6-flash";

// Nimba AI (Étape 6) — seule implémentation réelle de LLMProvider à ce jour. GEMINI_API_KEY reste
// optionnelle au démarrage (voir env.validation.ts) : le client `@google/genai` n'est JAMAIS
// construit dans le constructeur (qui ne doit jamais lever), seulement à l'intérieur de
// generate(), et seulement si isConfigured() est vrai. L'app doit toujours démarrer même sans clé
// — voir la matrice d'état de configuration du plan d'architecture Nimba AI.
@Injectable()
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("GEMINI_API_KEY") || undefined;
    this.model = config.get<string>("GEMINI_MODEL") || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(params: LLMGenerateParams): Promise<LLMResponse> {
    if (!this.apiKey) {
      // Défense en profondeur : l'orchestrateur doit vérifier isConfigured() avant d'appeler
      // generate() et ne jamais atteindre ce chemin, mais un appelant qui l'oublierait ne doit
      // jamais recevoir une réponse inventée — une erreur claire, jamais un texte fabriqué.
      throw new Error("GeminiProvider appelé sans GEMINI_API_KEY configurée.");
    }

    const client = new GoogleGenAI({ apiKey: this.apiKey });

    const systemParts = [
      params.systemPrompt,
      ...params.messages.filter((message) => message.role === "system").map((message) => message.content),
    ].filter((part): part is string => Boolean(part && part.trim()));

    const contents = params.messages
      .filter((message) => message.role !== "system")
      .map((message) => toGeminiContent(message));

    const tools = params.tools?.length
      ? [
          {
            functionDeclarations: params.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parametersJsonSchema: tool.parameters,
            })),
          },
        ]
      : undefined;

    const startedAt = Date.now();
    const response = await client.models.generateContent({
      model: this.model,
      contents,
      config: {
        ...(systemParts.length > 0 ? { systemInstruction: systemParts.join("\n\n") } : {}),
        ...(tools ? { tools } : {}),
      },
    });
    this.logger.debug(`generateContent (${this.model}) en ${Date.now() - startedAt}ms`);

    const toolCalls: LLMToolCall[] | undefined = response.functionCalls
      ?.filter((call) => Boolean(call.name))
      .map((call) => ({ name: call.name as string, arguments: call.args ?? {} }));

    return {
      text: response.text,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
      },
    };
  }
}

function toGeminiContent(message: LLMMessage): Content {
  if (message.role === "tool") {
    return {
      role: "user",
      parts: [{ functionResponse: { name: message.name ?? "", response: { output: message.content } } }],
    };
  }
  return {
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  };
}
