import { Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../../common/audit/audit.service";
import { PrismaService } from "../../database/prisma.service";

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
}

// Étape 7 (durcissement Auth) — "mes sessions actives" : chaque RefreshToken non révoqué et non
// expiré représente une session (device/navigateur) distincte, grâce à la rotation (chaque device
// maintient sa propre chaîne, voir AuthService.refreshTokens()). Jamais tokenHash exposé.
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(userId: string): Promise<SessionSummary[]> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    });
    return tokens;
  }

  async revoke(userId: string, sessionId: string, ipAddress: string | null): Promise<{ success: true }> {
    const session = await this.prisma.refreshToken.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException("Session introuvable");
    }
    // Jamais révoquer la session d'un autre utilisateur, même par id deviné -- 404 plutôt que 403
    // pour ne pas confirmer l'existence d'un id de session appartenant à quelqu'un d'autre.
    if (session.userId !== userId) {
      throw new NotFoundException("Session introuvable");
    }

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedReason: "user-revoked" },
    });

    this.audit.record({
      userId,
      method: "DELETE",
      path: `/auth/sessions/${sessionId}`,
      resourceType: "auth",
      resourceId: sessionId,
      action: "session-revoke",
      outcome: "SUCCESS",
      ipAddress,
    });

    return { success: true };
  }

  // "Déconnecter partout" : révoque TOUTES les sessions actives, y compris celle qui appelle ce
  // endpoint -- pas de notion de "session courante" côté serveur (l'access token ne porte aucun
  // lien vers le jti du refresh token qui l'a émis). L'appelant doit se reconnecter, y compris sur
  // cet appareil -- comportement volontairement simple, documenté ici plutôt qu'une exclusion
  // partielle fragile.
  async revokeAll(userId: string, ipAddress: string | null): Promise<{ success: true; revokedCount: number }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "user-revoked-all" },
    });

    this.audit.record({
      userId,
      method: "DELETE",
      path: "/auth/sessions",
      resourceType: "auth",
      resourceId: userId,
      action: "session-revoke-all",
      outcome: "SUCCESS",
      ipAddress,
    });

    return { success: true, revokedCount: result.count };
  }
}
