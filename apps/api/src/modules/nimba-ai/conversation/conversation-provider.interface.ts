import type { LLMMessage } from "../providers/llm-provider.interface";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

// Nimba AI — l'orchestrateur ne dépend jamais directement du frontend pour l'historique d'une
// conversation, toujours de cette interface (voir plan d'architecture Nimba AI, "Conversation").
// v1 : StatelessConversationProvider (rien persisté côté serveur). Plus tard : un
// DatabaseConversationProvider (nouveaux modèles Prisma) se substitue derrière la même interface
// sans toucher l'orchestrateur ni le contrôleur.
export interface ConversationProvider {
  // `clientProvidedHistory` : ce que le frontend a envoyé avec la requête (v1, mode sans état).
  // StatelessConversationProvider le renvoie tel quel ; un futur DatabaseConversationProvider
  // l'ignorerait et lirait sa propre source de vérité persistée à la place — c'est ce qui rend
  // l'implémentation swappable sans changer la signature.
  getHistory(conversationId: string, user: AuthenticatedUser, clientProvidedHistory?: LLMMessage[]): Promise<LLMMessage[]>;
  appendMessage(conversationId: string, message: LLMMessage, user: AuthenticatedUser): Promise<void>;
}

export const CONVERSATION_PROVIDER_TOKEN = "CONVERSATION_PROVIDER_TOKEN";
