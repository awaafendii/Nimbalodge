import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EmailProvider, SendEmailParams } from "../email-provider.interface";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_FROM_NAME = "NimbaLodge";

// Email réel (Étape 7 suite — email transactionnel) — seule implémentation réelle de EmailProvider
// à ce jour. Choisi pour son plan gratuit (300 emails/jour, à vie, sans carte bancaire) très
// largement suffisant pour un volume de reset de mot de passe. Appel HTTP direct (fetch global,
// Node ≥20 — voir package.json engines) plutôt qu'un SDK dédié : un seul endpoint utilisé, pas
// besoin d'une dépendance supplémentaire pour ça (même raisonnement que GeminiProvider utilisant
// le SDK officiel : ici il n'y a simplement pas de SDK officiel léger qui justifierait l'ajout).
// BREVO_API_KEY reste optionnelle au démarrage (voir env.validation.ts) : le client n'est jamais
// appelé dans le constructeur, seulement à l'intérieur de send(), et seulement si isConfigured()
// est vrai — l'app doit toujours démarrer même sans clé.
@Injectable()
export class BrevoProvider implements EmailProvider {
  readonly name = "brevo";
  private readonly logger = new Logger(BrevoProvider.name);
  private readonly apiKey?: string;
  private readonly fromAddress?: string;
  private readonly fromName: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("BREVO_API_KEY") || undefined;
    this.fromAddress = config.get<string>("EMAIL_FROM_ADDRESS") || undefined;
    this.fromName = config.get<string>("EMAIL_FROM_NAME") || DEFAULT_FROM_NAME;
  }

  // Une clé sans adresse d'expéditeur vérifiée n'a aucun sens (Brevo refuse l'envoi) — les deux
  // sont donc requises ensemble pour considérer le fournisseur "configuré".
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.fromAddress);
  }

  async send(params: SendEmailParams): Promise<void> {
    if (!this.apiKey || !this.fromAddress) {
      // Défense en profondeur : l'appelant doit vérifier isConfigured() avant send() et ne jamais
      // atteindre ce chemin, mais un appelant qui l'oublierait ne doit jamais échouer
      // silencieusement.
      throw new Error("BrevoProvider appelé sans BREVO_API_KEY/EMAIL_FROM_ADDRESS configurées.");
    }

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromAddress },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text,
      }),
    });

    if (!response.ok) {
      // Corps d'erreur Brevo jamais journalisé tel quel (pourrait contenir l'email destinataire) —
      // seul le statut HTTP est utile pour diagnostiquer une clé invalide/quota dépassé.
      throw new Error(`BrevoProvider : échec de l'envoi (HTTP ${response.status})`);
    }

    this.logger.log(`Email envoyé via Brevo (destinataire masqué, sujet : "${params.subject}")`);
  }
}
