import { randomBytes } from "node:crypto";

import { BadRequestException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PinoLogger } from "nestjs-pino";

import { AuditService } from "../../common/audit/audit.service";
import { hashToken } from "../../common/crypto/hash-token";
import { PrismaService } from "../../database/prisma.service";

// Étape 7 (durcissement Auth) — réinitialisation de mot de passe. Aucun fournisseur d'email n'est
// branché (décision explicite, pas d'infrastructure SMTP/API dans ce projet) : le lien est écrit
// dans les logs serveur uniquement, JAMAIS retourné dans la réponse HTTP — remplacer ce log par un
// vrai envoi (Resend/SendGrid/...) avant la mise en production réelle. Volontairement un appel
// logger.info() en clair (le token n'est PAS dans un chemin redact — voir logging.module.ts, qui ne
// masque que les req.body.* d'authentification réels) : c'est le seul endroit du projet où
// journaliser un secret est le comportement voulu, tant qu'aucun canal d'envoi réel n'existe. La
// réponse de requestReset() est volontairement identique que l'email existe ou non : empêche
// l'énumération de comptes via ce endpoint.
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(PasswordResetService.name);
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

    this.logger.info(
      { email, token: rawToken, expiresInMinutes: 30 },
      "Lien de réinitialisation de mot de passe (substitut d'envoi email, voir commentaire de tête de fichier)"
    );

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
