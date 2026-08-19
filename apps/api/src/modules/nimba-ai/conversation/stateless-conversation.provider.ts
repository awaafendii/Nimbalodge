import { Injectable } from "@nestjs/common";

import type { ConversationProvider } from "./conversation-provider.interface";
import type { LLMMessage } from "../providers/llm-provider.interface";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

// v1 — rien persisté côté serveur (voir plan d'architecture Nimba AI, "Conversation"). Le frontend
// garde la transcription en state React et l'envoie en entier à chaque tour ; ce provider se
// contente de la renvoyer telle quelle.
@Injectable()
export class StatelessConversationProvider implements ConversationProvider {
  async getHistory(
    _conversationId: string,
    _user: AuthenticatedUser,
    clientProvidedHistory: LLMMessage[] = []
  ): Promise<LLMMessage[]> {
    return clientProvidedHistory;
  }

  async appendMessage(_conversationId: string, _message: LLMMessage, _user: AuthenticatedUser): Promise<void> {
    // Rien à persister en v1 — voir le commentaire de tête de fichier.
  }
}
