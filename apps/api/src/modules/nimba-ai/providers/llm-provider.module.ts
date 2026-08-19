import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { GeminiProvider } from "./gemini.provider";
import { LLM_PROVIDER_TOKEN, type LLMProvider } from "./llm-provider.interface";

// Nimba AI (Étape 6). Sélection par LLM_PROVIDER (défaut "gemini", voir env.validation.ts) — même
// pattern que StorageProvider (Étape 7 Priority 4) : le reste du code ne dépend que de
// LLM_PROVIDER_TOKEN, jamais d'une implémentation concrète. Un LLM_PROVIDER explicitement réglé
// sur une valeur non supportée fait échouer le démarrage (erreur de configuration réelle) — ce qui
// est distinct d'une GEMINI_API_KEY absente, qui elle NE DOIT JAMAIS empêcher l'app de démarrer
// (GeminiProvider.isConfigured() gère ce cas à l'appel, pas au boot).
@Module({
  providers: [
    GeminiProvider,
    {
      provide: LLM_PROVIDER_TOKEN,
      useFactory: (config: ConfigService, geminiProvider: GeminiProvider): LLMProvider => {
        const providerName = config.get<string>("LLM_PROVIDER") || "gemini";
        switch (providerName) {
          case "gemini":
            return geminiProvider;
          default:
            throw new Error(`LLM_PROVIDER inconnu : "${providerName}". Fournisseurs supportés : gemini.`);
        }
      },
      inject: [ConfigService, GeminiProvider],
    },
  ],
  exports: [LLM_PROVIDER_TOKEN, GeminiProvider],
})
export class LlmProviderModule {}
