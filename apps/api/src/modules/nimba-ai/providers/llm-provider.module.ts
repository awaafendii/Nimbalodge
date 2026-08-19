import { Module } from "@nestjs/common";

import { FakeLLMProvider } from "./fake-llm.provider";
import { LLM_PROVIDER_TOKEN } from "./llm-provider.interface";

// Nimba AI (Étape 5). Résout toujours vers FakeLLMProvider pour l'instant — GeminiProvider
// n'existe pas encore. L'Étape 6 remplace le `useClass` ci-dessous par une factory qui lit
// LLM_PROVIDER (ConfigService) et choisit entre Gemini et Fake, même pattern que StorageProvider
// (Étape 7 Priority 4) — le reste du code (orchestrateur, Tools) ne dépend que de
// LLM_PROVIDER_TOKEN, jamais d'une implémentation concrète.
@Module({
  providers: [FakeLLMProvider, { provide: LLM_PROVIDER_TOKEN, useExisting: FakeLLMProvider }],
  exports: [LLM_PROVIDER_TOKEN, FakeLLMProvider],
})
export class LlmProviderModule {}
