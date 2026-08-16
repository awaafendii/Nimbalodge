import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  StatusBadge,
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import {
  useCleanHousekeepingTask,
  useCreateHousekeepingTask,
  useHousekeepingDashboard,
  useInspectHousekeepingTask,
} from "../../hooks/use-housekeeping.js";
import { useRooms } from "../../hooks/use-rooms.js";
import type { RoomHousekeepingStatusEntry } from "../../services/housekeeping.js";

// Référence de branchement (Étape 4, module 8/11) : un seul écran, piloté par
// GET /housekeeping-tasks/dashboard (Phase 10) — statut calculé par chambre (AVAILABLE si aucune
// tâche active ou dernière tâche INSPECTED, sinon TO_CLEAN/CLEANED), jamais dénormalisé sur Room.
// Pas de liste de tâches brute séparée : le dashboard est déjà la vue actionnable par chambre.
export default function HousekeepingPage() {
  return (
    <div className="flex flex-col gap-5">
      <HousekeepingDashboardCard />
    </div>
  );
}

function HousekeepingDashboardCard() {
  const dashboard = useHousekeepingDashboard();
  const rooms = useRooms();
  const createTask = useCreateHousekeepingTask();
  const clean = useCleanHousekeepingTask();
  const inspect = useInspectHousekeepingTask();
  const anyPending = createTask.isPending || clean.isPending || inspect.isPending;

  // GET /housekeeping-tasks/dashboard n'expose pas hotelId (une seule ligne par chambre, déjà
  // scopée côté backend) — dérivé depuis /rooms pour un demandeur org-wide, seul cas où le
  // backend exige hotelId explicitement (voir HousekeepingTasksService.create()).
  const hotelIdByRoomId = new Map((rooms.data ?? []).map((room) => [room.id, room.hotelId]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>État des chambres</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={dashboard.isLoading}
          error={dashboard.error}
          data={dashboard.data}
          onRetry={() => dashboard.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune chambre active"
          emptyDescription="Ajoutez des chambres actives (module Chambres) pour suivre leur état de nettoyage."
        >
          {(data) => {
            const columns: DataTableColumn<RoomHousekeepingStatusEntry>[] = [
              {
                id: "room",
                header: "Chambre",
                sortValue: (entry) => entry.roomNumber,
                cell: (entry) => <span className="font-[var(--fw-subtitle-strong)] text-sm">{entry.roomNumber}</span>,
              },
              {
                id: "status",
                header: "Statut",
                cell: (entry) => <StatusBadge status={entry.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (entry) => {
                  if (entry.status === "AVAILABLE") {
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={anyPending}
                        onClick={() =>
                          createTask.mutate({ roomId: entry.roomId, hotelId: hotelIdByRoomId.get(entry.roomId) })
                        }
                      >
                        Signaler à nettoyer
                      </Button>
                    );
                  }
                  if (entry.status === "TO_CLEAN" && entry.taskId) {
                    return (
                      <Button size="sm" disabled={anyPending} onClick={() => clean.mutate(entry.taskId!)}>
                        Marquer nettoyée
                      </Button>
                    );
                  }
                  if (entry.status === "CLEANED" && entry.taskId) {
                    return (
                      <Button size="sm" disabled={anyPending} onClick={() => inspect.mutate(entry.taskId!)}>
                        Marquer inspectée
                      </Button>
                    );
                  }
                  return null;
                },
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(entry) => entry.roomId}
                searchableText={(entry) => entry.roomNumber}
                searchPlaceholder="Rechercher une chambre…"
                emptyMessage="Aucune chambre ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}
