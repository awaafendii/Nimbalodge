import { randomUUID } from "node:crypto";

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import type { IncomingMessage, ServerResponse } from "http";

import type { AuthenticatedUser } from "../types/authenticated-request";

// Étape 7 (durcissement, Logging) — remplace le Logger par défaut de Nest par un logger structuré
// (JSON en production, lisible en développement) : niveau, contexte, requestId de corrélation,
// utilisateur/hôtel authentifiés, endpoint, durée, erreur avec stack UNIQUEMENT côté serveur (Nest
// ne renvoie jamais de stack dans une réponse HTTP par défaut — comportement déjà correct,
// inchangé ici). Jamais de mot de passe/token/secret journalisé : `redact` masque les chemins
// connus AVANT toute écriture, pas un filtrage a posteriori.
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>("NODE_ENV") === "production";
        return {
          pinoHttp: {
            level: isProduction ? "info" : "debug",
            transport: isProduction ? undefined : { target: "pino-pretty", options: { singleLine: true } },
            // Corrélation : réutilise x-request-id si le client/proxy en fournit un (Render ajoute
            // le sien), sinon en génère un — renvoyé au client sur le même en-tête pour permettre
            // de relier un rapport utilisateur à sa ligne de log exacte.
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const existing = req.headers["x-request-id"];
              const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
              res.setHeader("x-request-id", id);
              return id;
            },
            customProps: (req: IncomingMessage & { user?: AuthenticatedUser }) => ({
              userId: req.user?.id ?? null,
              hotelId: req.user?.hotelId ?? null,
              organizationId: req.user?.organizationId ?? null,
            }),
            // Chemins jamais journalisés, quelle que soit la route : mots de passe, tokens, codes
            // 2FA/reset, en-têtes d'authentification/cookies. `redact.remove` supprime le champ au
            // lieu de le remplacer par "[Redacted]" — aucune trace de sa présence/longueur.
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers[\"set-cookie\"]",
                "req.body.password",
                "req.body.newPassword",
                "req.body.currentPassword",
                "req.body.token",
                "req.body.refreshToken",
                "req.body.challengeToken",
                "req.body.code",
              ],
              remove: true,
            },
            serializers: {
              req(req: IncomingMessage & { url?: string; method?: string }) {
                return { method: req.method, url: req.url };
              },
            },
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggingModule {}
