// Nimba AI — abstraction fournisseur LLM (voir plan d'architecture Nimba AI). GeminiProvider
// (Étape 6) est la seule implémentation réelle de cette phase ; OpenAIProvider/AnthropicProvider/
// OpenRouterProvider s'ajouteront plus tard derrière la même interface, sans toucher
// l'orchestrateur ni les Tools. `generate()` ne calcule jamais de chiffre métier lui-même — voir
// la séparation des responsabilités du plan : le LLM comprend et génère du langage, le backend
// calcule.
export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export type LLMMessageRole = "user" | "assistant" | "system" | "tool";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
  toolCallId?: string;
}

export interface LLMToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface LLMResponse {
  text?: string;
  toolCalls?: LLMToolCall[];
  usage?: LLMUsage;
}

export interface LLMGenerateParams {
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  systemPrompt?: string;
}

export interface LLMProvider {
  readonly name: string;
  generate(params: LLMGenerateParams): Promise<LLMResponse>;
}

// Token d'injection — sélection du provider par LLM_PROVIDER (Étape 6, factory + ConfigService,
// même pattern que StorageProvider Étape 7 Priority 4). Provisoirement toujours résolu vers
// FakeLLMProvider (voir llm-provider.module.ts) tant que GeminiProvider n'existe pas.
export const LLM_PROVIDER_TOKEN = "LLM_PROVIDER_TOKEN";
