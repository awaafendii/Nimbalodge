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
  // Nom du tool/fonction concerné — requis pour un message role:"tool" (le résultat d'un appel de
  // Tool renvoyé au LLM doit être associé au nom exact du Tool invoqué, ex. Gemini
  // FunctionResponse.name). Découvert nécessaire en implémentant GeminiProvider (Étape 6).
  name?: string;
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
  // Modèle réellement utilisé pour cet appel (ex. "gemini-3.6-flash") — pour AiUsageLog.model
  // (Étape 9, AiChatService), jamais pour l'affichage utilisateur. Absent pour un provider sans
  // notion de modèle (ex. FakeLLMProvider) ; l'appelant retombe alors sur LLMProvider.name.
  model?: string;
}

export interface LLMGenerateParams {
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  systemPrompt?: string;
}

export interface LLMProvider {
  readonly name: string;
  // false si le fournisseur n'a pas les identifiants nécessaires (ex. GEMINI_API_KEY absente).
  // L'orchestrateur DOIT vérifier ceci AVANT tout appel à generate() — jamais d'appel réseau
  // "pour voir", et jamais un crash au démarrage de l'app pour une clé absente (voir la matrice
  // d'état de configuration du plan d'architecture Nimba AI).
  isConfigured(): boolean;
  generate(params: LLMGenerateParams): Promise<LLMResponse>;
}

// Token d'injection — sélection du provider par LLM_PROVIDER (Étape 6, factory + ConfigService,
// même pattern que StorageProvider Étape 7 Priority 4). Provisoirement toujours résolu vers
// FakeLLMProvider (voir llm-provider.module.ts) tant que GeminiProvider n'existe pas.
export const LLM_PROVIDER_TOKEN = "LLM_PROVIDER_TOKEN";
