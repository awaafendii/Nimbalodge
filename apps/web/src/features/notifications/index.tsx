import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, DataTable, type DataTableColumn } from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "../../hooks/use-notifications.js";
import type { Notification } from "../../services/notifications.js";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// Référence de branchement (Étape 4, module 11/11 — dernier de la liste Master Prompt §54) :
// "Alertes, échéances, audit" (subtitle nav-config.tsx). Le journal d'audit a été déplacé sur son
// propre écran (Étape 7, Priority 7 — voir features/audit-logs) une fois la pagination serveur et
// les filtres devenus trop riches pour une simple carte partagée avec Notifications.
export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <NotificationsCard />
    </div>
  );
}

function NotificationsCard() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = useNotifications(unreadOnly);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = (notifications.data ?? []).filter((notification) => !notification.isRead).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Notifications</CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={markAllRead.isPending || unreadCount === 0}
          onClick={() => markAllRead.mutate()}
        >
          Tout marquer comme lu
        </Button>
      </CardHeader>
      <CardContent>
        <label className="mb-3 flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={unreadOnly} onCheckedChange={(checked) => setUnreadOnly(checked === true)} />
          Non lues uniquement
        </label>

        <QueryState
          isLoading={notifications.isLoading}
          error={notifications.error}
          data={notifications.data}
          onRetry={() => notifications.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune notification"
          emptyDescription={
            unreadOnly ? "Aucune notification non lue." : "Vous n'avez reçu aucune notification pour le moment."
          }
        >
          {(data) => {
            const columns: DataTableColumn<Notification>[] = [
              {
                id: "content",
                header: "Notification",
                sortValue: (notification) => notification.createdAt,
                cell: (notification) => (
                  <div className="min-w-0">
                    <p className={notification.isRead ? "text-sm" : "text-sm font-[var(--fw-subtitle-strong)]"}>
                      {!notification.isRead ? <span className="mr-1.5 inline-block size-2 rounded-full bg-primary" /> : null}
                      {notification.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{notification.message}</p>
                  </div>
                ),
              },
              {
                id: "type",
                header: "Type",
                cell: (notification) => <Badge variant="secondary">{notification.type}</Badge>,
              },
              {
                id: "date",
                header: "Date",
                sortValue: (notification) => notification.createdAt,
                cell: (notification) => formatDateTime(notification.createdAt),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (notification) =>
                  !notification.isRead ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(notification.id)}
                    >
                      Marquer comme lu
                    </Button>
                  ) : null,
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(notification) => notification.id}
                emptyMessage="Aucune notification ne correspond à ces critères."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}
