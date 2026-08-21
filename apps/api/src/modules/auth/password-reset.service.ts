import { randomBytes } from "node:crypto";

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { PinoLogger } from "nestjs-pino";

import { AuditService } from "../../common/audit/audit.service";
import { hashToken } from "../../common/crypto/hash-token";
import { PrismaService } from "../../database/prisma.service";
import { EMAIL_PROVIDER_TOKEN, type EmailProvider, type SendEmailParams } from "../email/email-provider.interface";

// Étape 7 (durcissement Auth) puis email réel (suite) — réinitialisation de mot de passe. Sans
// fournisseur email configuré (BrevoProvider.isConfigured() faux — voir email.module.ts), le lien
// est écrit dans les logs serveur uniquement, JAMAIS retourné dans la réponse HTTP : comportement
// de repli pour un environnement dev/test sans BREVO_API_KEY, pas la voie normale une fois un
// fournisseur configuré. Volontairement un appel logger.info() en clair dans ce cas précis (le
// token n'est PAS dans un chemin redact — voir logging.module.ts, qui ne masque que les
// req.body.* d'authentification réels) : c'est le seul endroit du projet où journaliser un secret
// est le comportement voulu, tant qu'aucun canal d'envoi réel n'est configuré. La réponse de
// requestReset() est volontairement identique que l'email existe ou non, et que l'envoi réel
// réussisse ou échoue : empêche l'énumération de comptes via ce endpoint.
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class PasswordResetService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: PinoLogger,
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly emailProvider: EmailProvider
  ) {
    this.logger.setContext(PasswordResetService.name);
    this.webAppUrl = (this.config.get<string>("WEB_APP_URL") || this.config.get<string>("CORS_ORIGIN") || "").replace(/\/$/, "");
  }

  async requestReset(email: string, ipAddress: string | null): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      this.audit.record({
        method: "POST",
        path: "/auth/password-reset/request",
        resourceType: "auth",
        action: "password-reset-request",
        outcome: "FAILURE",
        errorMessage: `Compte introuvable ou inactif (email: ${email})`,
        ipAddress,
      });
      return { success: true };
    }

    const rawToken = randomBytes(32).toString("hex");
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    const resetUrl = `${this.webAppUrl}/reset-password?token=${rawToken}`;

    if (this.emailProvider.isConfigured()) {
      // Best-effort, jamais bloquant : le token existe déjà en base, un échec transitoire du
      // fournisseur (quota, panne réseau...) ne doit jamais faire échouer la requête ni révéler
      // quoi que ce soit de plus au client (même réponse générique dans tous les cas).
      await this.emailProvider.send(buildResetEmail(email, resetUrl)).catch((error: Error) => {
        this.logger.warn({ err: error }, "Échec de l'envoi de l'email de réinitialisation");
      });
    } else {
      this.logger.info(
        { email, token: rawToken, resetUrl, expiresInMinutes: 30 },
        "Lien de réinitialisation de mot de passe (aucun fournisseur email configuré, voir BREVO_API_KEY)"
      );
    }

    this.audit.record({
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      method: "POST",
      path: "/auth/password-reset/request",
      resourceType: "auth",
      resourceId: user.id,
      action: "password-reset-request",
      outcome: "SUCCESS",
      ipAddress,
    });

    return { success: true };
  }

  async confirmReset(rawToken: string, newPassword: string, ipAddress: string | null): Promise<{ success: true }> {
    const stored = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash: hashToken(rawToken), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!stored) {
      this.audit.record({
        method: "POST",
        path: "/auth/password-reset/confirm",
        resourceType: "auth",
        action: "password-reset-confirm",
        outcome: "FAILURE",
        errorMessage: "Lien de réinitialisation invalide, expiré ou déjà utilisé",
        ipAddress,
      });
      throw new BadRequestException("Lien de réinitialisation invalide ou expiré");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const user = await this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } });
    await this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } });

    // Un mot de passe changé invalide toutes les sessions existantes -- si l'ancien mot de passe a
    // fuité, les sessions ouvertes avec lui ne doivent pas rester valides après la réinitialisation.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "password-reset" },
    });

    this.audit.record({
      userId: user.id,
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      method: "POST",
      path: "/auth/password-reset/confirm",
      resourceType: "auth",
      resourceId: user.id,
      action: "password-reset-confirm",
      outcome: "SUCCESS",
      ipAddress,
    });

    return { success: true };
  }
}

function buildResetEmail(email: string, resetUrl: string): SendEmailParams {
  return {
    to: email,
    subject: "Réinitialisation de votre mot de passe NimbaLodge",
    text:
      `Une réinitialisation de mot de passe a été demandée pour ce compte NimbaLodge.\n\n` +
      `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 30 minutes) :\n${resetUrl}\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.`,
    html:
      `<p>Une réinitialisation de mot de passe a été demandée pour ce compte NimbaLodge.</p>` +
      `<p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a> (valable 30 minutes).</p>` +
      `<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.</p>`,
  };
}
