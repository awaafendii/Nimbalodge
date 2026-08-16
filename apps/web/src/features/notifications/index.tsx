import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  DataTable,
  Input,
  Label,
  StatusBadge,
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useAuditLogs } from "../../hooks/use-audit-logs.js";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "../../hooks/use-notifications.js";
import type { AuditLog } from "../../services/audit-logs.js";
import type { Notification } from "../../services/notifications.js";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// Référence de branchement (Étape 4, module 11/11 — dernier de la liste Master Prompt §54) :
// "Alertes, échéances, audit" (subtitle nav-config.tsx) — Notifications (par utilisateur, jamais
// scopées hôtel/organisation comme les autres ressources, voir NotificationsService.list()) et
// Audit (lecture seule, écrit par AuditInterceptor global depuis la Phase 2) sur le même écran.
export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <NotificationsCard />
      <AuditLogsCard />
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

function AuditLogsCard() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [resourceType, setResourceType] = useState("");

  const auditLogs = useAuditLogs({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    resourceType: resourceType || undefined,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal d'audit</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-date-from">Du (optionnel)</Label>
            <Input id="audit-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-date-to">Au (optionnel)</Label>
            <Input id="audit-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-resource-type">Type de ressource (optionnel)</Label>
            <Input
              id="audit-resource-type"
              placeholder="expense, reservation…"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            />
          </div>
        </div>

        <QueryState
          isLoading={auditLogs.isLoading}
          error={auditLogs.error}
          data={auditLogs.data}
          onRetry={() => auditLogs.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune entrée d'audit"
          emptyDescription="Ajustez les filtres ci-dessus ou vérifiez qu'une action mutante a déjà été effectuée."
        >
          {(data) => {
            const columns: DataTableColumn<AuditLog>[] = [
              {
                id: "date",
                header: "Date",
                sortValue: (log) => log.createdAt,
                cell: (log) => formatDateTime(log.createdAt),
              },
              {
                id: "action",
                header: "Action",
                cell: (log) => (
                  <span className="font-mono text-xs">
                    {log.method} {log.path}
                  </span>
                ),
              },
              {
                id: "resourceType",
                header: "Ressource",
                sortValue: (log) => log.resourceType ?? "",
                cell: (log) => log.resourceType ?? "—",
              },
              {
                id: "outcome",
                header: "Résultat",
                cell: (log) => <StatusBadge status={log.outcome} />,
              },
              {
                id: "ip",
                header: "IP",
                cell: (log) => log.ipAddress ?? "—",
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(log) => log.id}
                searchableText={(log) => `${log.method} ${log.path} ${log.resourceType ?? ""}`}
                searchPlaceholder="Rechercher par méthode, chemin, ressource…"
                emptyMessage="Aucune entrée ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}
