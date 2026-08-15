import type { Notification } from "@prisma/client";

export function toNotificationResponse(notification: Notification) {
  return {
    id: notification.id,
    hotelId: notification.hotelId,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link,
    relatedType: notification.relatedType,
    relatedId: notification.relatedId,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}
