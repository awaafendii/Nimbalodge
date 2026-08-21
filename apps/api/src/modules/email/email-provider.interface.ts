// Abstraction fournisseur email — même pattern que LLMProvider (nimba-ai/providers) et
// StorageProvider (documents/storage) : le reste du code ne dépend que de cette interface, jamais
// d'un SDK/API concret. BrevoProvider (providers/brevo.provider.ts) est la seule implémentation
// réelle à ce jour ; un futur SendGridProvider/SesProvider s'ajouterait derrière la même interface.
export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  // false si le fournisseur n'a pas les identifiants nécessaires (ex. BREVO_API_KEY absente).
  // L'appelant DOIT vérifier ceci avant tout appel à send() — jamais d'appel réseau "pour voir",
  // et jamais un crash au démarrage de l'app pour une clé absente (même contrat que
  // LLMProvider.isConfigured()).
  isConfigured(): boolean;
  send(params: SendEmailParams): Promise<void>;
}

export const EMAIL_PROVIDER_TOKEN = "EMAIL_PROVIDER_TOKEN";
