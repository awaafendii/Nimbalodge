import { apiClient } from "./api-client.js";

export interface Notification {
  id: string;
  hotelId: string | null;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export function listNotifications(unreadOnly?: boolean): Promise<Notification[]> {
  const query = unreadOnly ? "?unreadOnly=true" : "";
  return apiClient.get<Notification[]>(`/notifications${query}`);
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiClient.post<Notification>(`/notifications/${id}/read`);
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiClient.post<{ updated: number }>("/notifications/read-all");
}
