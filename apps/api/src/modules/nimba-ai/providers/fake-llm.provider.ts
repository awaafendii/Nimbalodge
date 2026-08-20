import { Injectable } from "@nestjs/common";

import type { LLMGenerateParams, LLMProvider, LLMResponse } from "./llm-provider.interface";

// Double de test — jamais d'appel réseau réel, aucune clé API requise. Sert dans les tests
// unitaires/e2e de Nimba AI (Étape 9, Assistant conversationnel, et Étape 11, tests sécurité) pour
// exercer l'orchestrateur de bout en bout sans dépendre de Gemini. Réponses programmables via
// enqueue() ; sans rien de programmé, renvoie un texte neutre plutôt que d'échouer — un test qui ne
// se soucie pas du contenu exact de la réponse LLM ne doit pas être forcé de la configurer.
@Injectable()
export class FakeLLMProvider implements LLMProvider {
  readonly name = "fake";
  private readonly queue: LLMResponse[] = [];
  private readonly errorQueue: Error[] = [];

  enqueue(response: LLMResponse): void {
    this.queue.push(response);
  }

  // Nimba AI (Étape 11 — tests sécurité) : simule un échec fournisseur (quota, timeout, panne...)
  // de façon déterministe en e2e, sans dépendre d'un vrai appel réseau — vérifie qu'une erreur LLM
  // ne casse jamais Insights/Anomalies déterministes (voir nimba-ai-security.e2e-spec.ts).
  enqueueError(error: Error): void {
    this.errorQueue.push(error);
  }

  isConfigured(): boolean {
    return true;
  }

  async generate(_params: LLMGenerateParams): Promise<LLMResponse> {
    const nextError = this.errorQueue.shift();
    if (nextError) throw nextError;
    const next = this.queue.shift();
    return next ?? { text: "[réponse simulée FakeLLMProvider]" };
  }
}
