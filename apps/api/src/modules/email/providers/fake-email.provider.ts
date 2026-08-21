import { Injectable } from "@nestjs/common";

import type { EmailProvider, SendEmailParams } from "../email-provider.interface";

// Double de test — jamais d'appel réseau réel, aucune clé API requise. Substitué à BrevoProvider
// dans tous les tests e2e (test-app.ts, overrideProvider(EMAIL_PROVIDER_TOKEN)), même pattern que
// FakeLLMProvider. `configured` démarre à `false` (reflète l'état par défaut d'un environnement
// sans BREVO_API_KEY) : la suite existante (password-reset.e2e-spec.ts) vérifie déjà le chemin de
// repli "non configuré → lien journalisé, jamais envoyé" et ne doit pas changer de comportement.
// Un test qui veut exercer le chemin "email réellement envoyé" appelle setConfigured(true).
@Injectable()
export class FakeEmailProvider implements EmailProvider {
  readonly name = "fake";
  private configured = false;
  readonly sentEmails: SendEmailParams[] = [];

  setConfigured(value: boolean): void {
    this.configured = value;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async send(params: SendEmailParams): Promise<void> {
    if (!this.configured) {
      throw new Error("FakeEmailProvider appelé sans être configuré (voir setConfigured()).");
    }
    this.sentEmails.push(params);
  }

  clear(): void {
    this.sentEmails.length = 0;
  }
}
