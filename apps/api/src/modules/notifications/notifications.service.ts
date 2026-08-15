import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../../common/types/authenticated-request";
import { PrismaService } from "../../database/prisma.service";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { toNotificationResponse } from "./dto/notification-response.dto";

export interface NotifyUsersWithPermissionParams {
  hotelId: string;
  organizationId: string;
  permissionKey: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  relatedType?: string;
  relatedId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Isolation strictement "ses propres notifications" — contrairement à tout le reste du schéma,
  // pas de scope hôtel/organisation dérivé du demandeur (même SUPER_ADMIN ne voit que les siennes).
  async list(query: ListNotificationsQueryDto, requester: AuthenticatedUser) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId: requester.id, ...(query.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return notifications.map(toNotificationResponse);
  }

  async markRead(id: string, requester: AuthenticatedUser) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException("Notification introuvable");
    }
    if (notification.userId !== requester.id) {
      throw new ForbiddenException("Cette notification ne vous appartient pas");
    }
    if (notification.isRead) {
      return toNotificationResponse(notification);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return toNotificationResponse(updated);
  }

  async markAllRead(requester: AuthenticatedUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: requester.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  // Fan-out réutilisable : notifie tous les utilisateurs actifs de l'hôtel (+ les org-wide, ex.
  // SUPER_ADMIN) détenant `permissionKey`. Déduplique via relatedType/relatedId : si une
  // notification existe déjà pour cette paire, aucune nouvelle n'est créée (évite le spam d'alertes
  // répétées, ex. BudgetsService.checkOverspendAlerts()). Réutilisable par tout futur déclencheur
  // d'alerte, pas seulement les budgets.
  async notifyUsersWithPermission(params: NotifyUsersWithPermissionParams): Promise<number> {
    if (params.relatedType && params.relatedId) {
      const existing = await this.prisma.notification.findFirst({
        where: { relatedType: params.relatedType, relatedId: params.relatedId },
      });
      if (existing) {
        return 0;
      }
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ hotelId: params.hotelId }, { hotelId: null, organizationId: params.organizationId }],
        roles: { some: { role: { permissions: { some: { permission: { key: params.permissionKey } } } } } },
      },
      select: { id: true },
    });
    if (recipients.length === 0) {
      return 0;
    }

    await this.prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        hotelId: params.hotelId,
        userId: recipient.id,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        relatedType: params.relatedType,
        relatedId: params.relatedId,
      })),
    });
    return recipients.length;
  }
}
