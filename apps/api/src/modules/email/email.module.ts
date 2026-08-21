import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EMAIL_PROVIDER_TOKEN, type EmailProvider } from "./email-provider.interface";
import { BrevoProvider } from "./providers/brevo.provider";

// Sélection par EMAIL_PROVIDER (défaut "brevo", voir env.validation.ts) — même pattern que
// LlmProviderModule/StorageProvider : le reste du code ne dépend que de EMAIL_PROVIDER_TOKEN,
// jamais d'une implémentation concrète. Un EMAIL_PROVIDER explicitement réglé sur une valeur non
// supportée fait échouer le démarrage (erreur de configuration réelle) — distinct de
// BREVO_API_KEY absente, qui elle NE DOIT JAMAIS empêcher l'app de démarrer
// (BrevoProvider.isConfigured() gère ce cas à l'appel, pas au boot).
@Module({
  providers: [
    BrevoProvider,
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useFactory: (config: ConfigService, brevoProvider: BrevoProvider): EmailProvider => {
        const providerName = config.get<string>("EMAIL_PROVIDER") || "brevo";
        switch (providerName) {
          case "brevo":
            return brevoProvider;
          default:
            throw new Error(`EMAIL_PROVIDER inconnu : "${providerName}". Fournisseurs supportés : brevo.`);
        }
      },
      inject: [ConfigService, BrevoProvider],
    },
  ],
  exports: [EMAIL_PROVIDER_TOKEN],
})
export class EmailModule {}
