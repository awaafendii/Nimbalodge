import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  StatusBadge,
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useAuditLog, useAuditLogs } from "../../hooks/use-audit-logs.js";
import { useDepartments } from "../../hooks/use-departments.js";
import { useHotels } from "../../hooks/use-hotels.js";
import { useUsers } from "../../hooks/use-users.js";
import type { AuditLog, AuditLogFilters } from "../../services/audit-logs.js";
import { useAuthStore } from "../../stores/auth-store.js";

const PAGE_SIZE = 20;
const ALL = "all";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

interface Filters {
  search: string;
  userId: string;
  resourceType: string;
  action: string;
  departmentId: string;
  hotelId: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  userId: ALL,
  resourceType: "",
  action: "",
  departmentId: ALL,
  hotelId: ALL,
  dateFrom: "",
  dateTo: "",
};

// Référence de branchement (Étape 7, Priority 7) — écran dédié (déplacé hors de Notifications, où
// une simple carte suffisait avant que le brief §Production Readiness ne demande pagination
// serveur + filtres + détail before/after). Gardé par la permission audit-logs.view côté backend
// (voir audit-logs.controller.ts) : un demandeur sans cette permission voit la page mais l'appel API
// échoue en 403, affiché proprement par QueryState — pas de garde de route dédiée, cohérent avec le
// reste de l'app (voir router.tsx).
export default function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const isOrgWide = useAuthStore((s) => s.user?.hotel === null);
  const departments = useDepartments();
  const hotels = useHotels();
  const users = useUsers();

  const usersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users.data ?? []) map.set(u.id, `${u.firstName} ${u.lastName}`);
    return map;
  }, [users.data]);

  const queryFilters: AuditLogFilters = {
    search: filters.search || undefined,
    userId: filters.userId === ALL ? undefined : filters.userId,
    resourceType: filters.resourceType || undefined,
    action: filters.action || undefined,
    departmentId: filters.departmentId === ALL ? undefined : filters.departmentId,
    hotelId: filters.hotelId === ALL ? undefined : filters.hotelId,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const auditLogs = useAuditLogs(queryFilters);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "userId" || key === "departmentId" || key === "hotelId") return value !== ALL;
    return value !== "";
  });

  const columns: DataTableColumn<AuditLog>[] = [
    {
      id: "date",
      header: "Date",
      cell: (log) => formatDateTime(log.createdAt),
    },
    {
      id: "actor",
      header: "Utilisateur",
      cell: (log) => (log.userId ? (usersById.get(log.userId) ?? log.userId) : "—"),
    },
    {
      id: "action",
      header: "Action",
      cell: (log) => (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit font-mono text-[11px]">
            {log.action}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {log.method} {log.path}
          </span>
        </div>
      ),
    },
    {
      id: "resource",
      header: "Ressource",
      cell: (log) => (
        <div className="flex flex-col">
          <span>{log.resourceType ?? "—"}</span>
          {log.resourceId ? <span className="font-mono text-[11px] text-muted-foreground">{log.resourceId}</span> : null}
        </div>
      ),
    },
    {
      id: "department",
      header: "Département",
      cell: (log) => departments.data?.find((d) => d.id === log.departmentId)?.name ?? "—",
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
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Journal d'audit</CardTitle>
          {hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Réinitialiser les filtres
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-date-from">Du</Label>
              <Input
                id="audit-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-date-to">Au</Label>
              <Input
                id="audit-date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-resource-type">Module / ressource</Label>
              <Input
                id="audit-resource-type"
                placeholder="expenses, reservations…"
                value={filters.resourceType}
                onChange={(e) => updateFilter("resourceType", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="audit-action">Action</Label>
              <Input
                id="audit-action"
                placeholder="create, approve, book…"
                value={filters.action}
                onChange={(e) => updateFilter("action", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Utilisateur</Label>
              <Select value={filters.userId} onValueChange={(value) => updateFilter("userId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les utilisateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les utilisateurs</SelectItem>
                  {(users.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Département</Label>
              <Select value={filters.departmentId} onValueChange={(value) => updateFilter("departmentId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les départements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les départements</SelectItem>
                  {(departments.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isOrgWide ? (
              <div className="flex flex-col gap-1.5">
                <Label>Hôtel</Label>
                <Select value={filters.hotelId} onValueChange={(value) => updateFilter("hotelId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les hôtels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Tous les hôtels</SelectItem>
                    {(hotels.data ?? []).map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <QueryState
            isLoading={auditLogs.isLoading}
            error={auditLogs.error}
            data={auditLogs.data}
            onRetry={() => auditLogs.refetch()}
            isEmpty={(data) => data.items.length === 0}
            emptyTitle="Aucune entrée d'audit"
            emptyDescription="Ajustez les filtres ci-dessus ou vérifiez qu'une action mutante a déjà été effectuée."
          >
            {(data) => (
              <DataTable
                columns={columns}
                data={data.items}
                getRowId={(log) => log.id}
                onRowClick={(log) => setSelectedLogId(log.id)}
                emptyMessage="Aucune entrée ne correspond à ces critères."
                serverSearch={{
                  value: filters.search,
                  onChange: (value) => updateFilter("search", value),
                  placeholder: "Rechercher par méthode, chemin, ressource, action…",
                }}
                serverPagination={{
                  page: data.page,
                  pageCount: data.pageCount,
                  totalCount: data.total,
                  onPageChange: setPage,
                }}
              />
            )}
          </QueryState>
        </CardContent>
      </Card>

      <AuditLogDetailSheet logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </div>
  );
}

function AuditLogDetailSheet({ logId, onClose }: { logId: string | null; onClose: () => void }) {
  const detail = useAuditLog(logId);

  return (
    <Sheet open={logId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Détail de l'entrée d'audit</SheetTitle>
        </SheetHeader>
        <QueryState
          isLoading={detail.isLoading}
          error={detail.error}
          data={detail.data}
          onRetry={() => detail.refetch()}
        >
          {(log) => (
            <div className="mt-4 flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatDateTime(log.createdAt)}</dd>
                <dt className="text-muted-foreground">Action</dt>
                <dd className="font-mono text-xs">{log.action}</dd>
                <dt className="text-muted-foreground">Requête</dt>
                <dd className="font-mono text-xs">
                  {log.method} {log.path}
                </dd>
                <dt className="text-muted-foreground">Ressource</dt>
                <dd>
                  {log.resourceType ?? "—"} {log.resourceId ? <span className="font-mono text-xs">({log.resourceId})</span> : null}
                </dd>
                <dt className="text-muted-foreground">Résultat</dt>
                <dd>
                  <StatusBadge status={log.outcome} />
                </dd>
                <dt className="text-muted-foreground">IP</dt>
                <dd>{log.ipAddress ?? "—"}</dd>
                {log.errorMessage ? (
                  <>
                    <dt className="text-muted-foreground">Erreur</dt>
                    <dd className="text-critical">{log.errorMessage}</dd>
                  </>
                ) : null}
              </dl>

              <Separator />

              <div className="flex flex-col gap-2">
                <p className="text-sm font-[var(--fw-subtitle-strong)]">Avant</p>
                <JsonBlock value={log.before} />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-[var(--fw-subtitle-strong)]">Après</p>
                <JsonBlock value={log.after} />
              </div>
            </div>
          )}
        </QueryState>
      </SheetContent>
    </Sheet>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-muted-foreground">Aucune donnée.</p>;
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-md border border-border bg-secondary/40 p-3 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
