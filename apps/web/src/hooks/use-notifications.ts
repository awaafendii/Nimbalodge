import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as notificationsService from "../services/notifications.js";

function notificationsKey(unreadOnly: boolean) {
  return ["notifications", { unreadOnly }] as const;
}

export function useNotifications(unreadOnly: boolean) {
  return useQuery({
    queryKey: notificationsKey(unreadOnly),
    queryFn: () => notificationsService.listNotifications(unreadOnly),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
