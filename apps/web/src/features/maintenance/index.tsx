import { useState, type FormEvent } from "react";
import { fmtGNF } from "@nimbalodge/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Icons,
  Input,
  Label,
  StatusBadge,
  Textarea,
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useAssets, useCreateAsset, useUpdateAsset } from "../../hooks/use-assets.js";
import { useHotels } from "../../hooks/use-hotels.js";
import {
  useCancelMaintenanceIntervention,
  useCompleteMaintenanceIntervention,
  useCreateMaintenanceIntervention,
  useMaintenanceInterventions,
  useStartMaintenanceIntervention,
} from "../../hooks/use-maintenance-interventions.js";
import {
  useApproveMaintenanceRequest,
  useCancelMaintenanceRequest,
  useCreateMaintenanceRequest,
  useMaintenanceRequests,
  useRejectMaintenanceRequest,
} from "../../hooks/use-maintenance-requests.js";
import { useRooms } from "../../hooks/use-rooms.js";
import type { Asset } from "../../services/assets.js";
import type { MaintenanceIntervention, MaintenanceInterventionType } from "../../services/maintenance-interventions.js";
import type { MaintenanceRequest } from "../../services/maintenance-requests.js";
import { useAuthStore } from "../../stores/auth-store.js";

const INTERVENTION_TYPE_LABELS: Record<MaintenanceInterventionType, string> = {
  PREVENTIVE: "Préventive",
  CORRECTIVE: "Corrective",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Référence de branchement (Étape 4, module 9/11) : "Équipements, interventions" (subtitle
// nav-config.tsx). Équipements avant Demandes/Interventions (elles peuvent référencer un
// équipement déjà créé, comme Fournisseur avant Commande en Phase 9).
export default function MaintenancePage() {
  return (
    <div className="flex flex-col gap-5">
      <AssetsCard />
      <MaintenanceRequestsCard />
      <MaintenanceInterventionsCard />
    </div>
  );
}

function AssetsCard() {
  const user = useAuthStore((s) => s.user);
  const assets = useAssets();
  const updateAsset = useUpdateAsset();
  const rooms = useRooms();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  const roomNumberById = new Map((rooms.data ?? []).map((room) => [room.id, room.number]));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Équipements</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Ajouter un équipement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateAssetForm
              roomOptions={rooms.data ?? []}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={assets.isLoading}
          error={assets.error}
          data={assets.data}
          onRetry={() => assets.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun équipement enregistré"
          emptyDescription="Ajoutez votre premier équipement pour commencer à suivre la maintenance."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Ajouter un équipement
            </Button>
          }
        >
          {(data) => {
            const columns: DataTableColumn<Asset>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (asset) => asset.name.toLowerCase(),
                cell: (asset) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{asset.name}</span>
                    {!asset.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                  </div>
                ),
              },
              {
                id: "room",
                header: "Chambre",
                cell: (asset) => (asset.roomId ? (roomNumberById.get(asset.roomId) ?? "—") : "—"),
              },
              {
                id: "category",
                header: "Catégorie",
                cell: (asset) => asset.category ?? "—",
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (asset) => (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateAsset.isPending}
                    onClick={() => updateAsset.mutate({ id: asset.id, input: { isActive: !asset.isActive } })}
                  >
                    {asset.isActive ? "Désactiver" : "Réactiver"}
                  </Button>
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(asset) => asset.id}
                searchableText={(asset) => `${asset.name} ${asset.category ?? ""} ${asset.serialNumber ?? ""}`}
                searchPlaceholder="Rechercher un équipement…"
                emptyMessage="Aucun équipement ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateAssetForm({
  roomOptions,
  hotelOptions,
  onDone,
}: {
  roomOptions: { id: string; number: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createAsset = useCreateAsset();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name) return;
    createAsset.mutate(
      {
        name,
        roomId: roomId || undefined,
        category: category || undefined,
        serialNumber: serialNumber || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un équipement</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-hotel">Hôtel</Label>
          <select
            id="asset-hotel"
            required
            value={hotelId}
            onChange={(event) => setHotelId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Sélectionner un hôtel
            </option>
            {hotelOptions.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-name">Nom</Label>
        <Input id="asset-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-category">Catégorie (optionnel)</Label>
          <Input id="asset-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset-room">Chambre (optionnel)</Label>
          <select
            id="asset-room"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucune</option>
            {roomOptions.map((room) => (
              <option key={room.id} value={room.id}>
                {room.number}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asset-serial">Numéro de série (optionnel)</Label>
        <Input id="asset-serial" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
      </div>

      {createAsset.isError ? (
        <p className="text-sm text-destructive">
          {createAsset.error instanceof Error ? createAsset.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createAsset.isPending}>
          {createAsset.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function MaintenanceRequestsCard() {
  const user = useAuthStore((s) => s.user);
  const requests = useMaintenanceRequests();
  const assets = useAssets();
  const rooms = useRooms();
  const hotels = useHotels();
  const approve = useApproveMaintenanceRequest();
  const reject = useRejectMaintenanceRequest();
  const cancel = useCancelMaintenanceRequest();
  const [dialogOpen, setDialogOpen] = useState(false);

  const assetNameById = new Map((assets.data ?? []).map((asset) => [asset.id, asset.name]));
  const roomNumberById = new Map((rooms.data ?? []).map((room) => [room.id, room.number]));
  const anyPending = approve.isPending || reject.isPending || cancel.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Demandes de maintenance</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateMaintenanceRequestForm
              assetOptions={assets.data ?? []}
              roomOptions={rooms.data ?? []}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={requests.isLoading}
          error={requests.error}
          data={requests.data}
          onRetry={() => requests.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune demande de maintenance"
          emptyDescription="Créez votre première demande de maintenance."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Nouvelle demande
            </Button>
          }
        >
          {(data) => {
            const columns: DataTableColumn<MaintenanceRequest>[] = [
              {
                id: "description",
                header: "Description",
                sortValue: (request) => request.description.toLowerCase(),
                cell: (request) => (
                  <div>
                    <p className="text-sm">{request.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.assetId ? assetNameById.get(request.assetId) : null}
                      {request.roomId ? ` · Chambre ${roomNumberById.get(request.roomId) ?? "—"}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                id: "status",
                header: "Statut",
                cell: (request) => <StatusBadge status={request.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (request) =>
                  request.status === "PENDING" ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" disabled={anyPending} onClick={() => approve.mutate(request.id)}>
                        Approuver
                      </Button>
                      <Button variant="outline" size="sm" disabled={anyPending} onClick={() => reject.mutate(request.id)}>
                        Rejeter
                      </Button>
                      <Button variant="outline" size="sm" disabled={anyPending} onClick={() => cancel.mutate(request.id)}>
                        Annuler
                      </Button>
                    </div>
                  ) : null,
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(request) => request.id}
                searchableText={(request) => request.description}
                searchPlaceholder="Rechercher une demande…"
                emptyMessage="Aucune demande ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateMaintenanceRequestForm({
  assetOptions,
  roomOptions,
  hotelOptions,
  onDone,
}: {
  assetOptions: { id: string; name: string }[];
  roomOptions: { id: string; number: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createRequest = useCreateMaintenanceRequest();
  const [description, setDescription] = useState("");
  const [assetId, setAssetId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!description) return;
    createRequest.mutate(
      {
        description,
        assetId: assetId || undefined,
        roomId: roomId || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouvelle demande de maintenance</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mr-hotel">Hôtel</Label>
          <select
            id="mr-hotel"
            required
            value={hotelId}
            onChange={(event) => setHotelId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Sélectionner un hôtel
            </option>
            {hotelOptions.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mr-description">Description</Label>
        <Textarea id="mr-description" required value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mr-asset">Équipement (optionnel)</Label>
          <select
            id="mr-asset"
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucun</option>
            {assetOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mr-room">Chambre (optionnel)</Label>
          <select
            id="mr-room"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucune</option>
            {roomOptions.map((room) => (
              <option key={room.id} value={room.id}>
                {room.number}
              </option>
            ))}
          </select>
        </div>
      </div>

      {createRequest.isError ? (
        <p className="text-sm text-destructive">
          {createRequest.error instanceof Error ? createRequest.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createRequest.isPending}>
          {createRequest.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function MaintenanceInterventionsCard() {
  const user = useAuthStore((s) => s.user);
  const interventions = useMaintenanceInterventions();
  const assets = useAssets();
  const rooms = useRooms();
  const requests = useMaintenanceRequests();
  const hotels = useHotels();
  const start = useStartMaintenanceIntervention();
  const complete = useCompleteMaintenanceIntervention();
  const cancel = useCancelMaintenanceIntervention();
  const [dialogOpen, setDialogOpen] = useState(false);

  const assetNameById = new Map((assets.data ?? []).map((asset) => [asset.id, asset.name]));
  const roomNumberById = new Map((rooms.data ?? []).map((room) => [room.id, room.number]));
  const approvedRequests = (requests.data ?? []).filter((request) => request.status === "APPROVED");
  const anyPending = start.isPending || complete.isPending || cancel.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Interventions</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Planifier une intervention
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateInterventionForm
              assetOptions={assets.data ?? []}
              roomOptions={rooms.data ?? []}
              requestOptions={approvedRequests}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={interventions.isLoading}
          error={interventions.error}
          data={interventions.data}
          onRetry={() => interventions.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune intervention planifiée"
          emptyDescription="Planifiez votre première intervention (préventive ou corrective)."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Planifier une intervention
            </Button>
          }
        >
          {(data) => {
            const columns: DataTableColumn<MaintenanceIntervention>[] = [
              {
                id: "type",
                header: "Type",
                cell: (intervention) => <Badge variant="secondary">{INTERVENTION_TYPE_LABELS[intervention.type]}</Badge>,
              },
              {
                id: "target",
                header: "Cible",
                cell: (intervention) => {
                  const parts = [
                    intervention.assetId ? assetNameById.get(intervention.assetId) : null,
                    intervention.roomId ? `Chambre ${roomNumberById.get(intervention.roomId) ?? "—"}` : null,
                  ].filter(Boolean);
                  return parts.length > 0 ? parts.join(" · ") : "—";
                },
              },
              {
                id: "scheduledDate",
                header: "Date planifiée",
                sortValue: (intervention) => intervention.scheduledDate ?? "",
                cell: (intervention) => (intervention.scheduledDate ? formatDate(intervention.scheduledDate) : "—"),
              },
              {
                id: "cost",
                header: "Coût",
                align: "right",
                sortValue: (intervention) => Number(intervention.cost ?? 0),
                cell: (intervention) => (intervention.cost ? fmtGNF(Number(intervention.cost)) : "—"),
              },
              {
                id: "status",
                header: "Statut",
                cell: (intervention) => <StatusBadge status={intervention.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (intervention) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    {intervention.status === "SCHEDULED" ? (
                      <Button size="sm" disabled={anyPending} onClick={() => start.mutate(intervention.id)}>
                        Démarrer
                      </Button>
                    ) : null}
                    {intervention.status === "IN_PROGRESS" ? (
                      <Button size="sm" disabled={anyPending} onClick={() => complete.mutate(intervention.id)}>
                        Terminer
                      </Button>
                    ) : null}
                    {intervention.status === "SCHEDULED" || intervention.status === "IN_PROGRESS" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={anyPending}
                        onClick={() => cancel.mutate(intervention.id)}
                      >
                        Annuler
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(intervention) => intervention.id}
                searchableText={(intervention) =>
                  intervention.assetId ? (assetNameById.get(intervention.assetId) ?? "") : ""
                }
                searchPlaceholder="Rechercher par équipement…"
                emptyMessage="Aucune intervention ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateInterventionForm({
  assetOptions,
  roomOptions,
  requestOptions,
  hotelOptions,
  onDone,
}: {
  assetOptions: { id: string; name: string }[];
  roomOptions: { id: string; number: string }[];
  requestOptions: { id: string; description: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createIntervention = useCreateMaintenanceIntervention();
  const [type, setType] = useState<MaintenanceInterventionType>("PREVENTIVE");
  const [assetId, setAssetId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [maintenanceRequestId, setMaintenanceRequestId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [cost, setCost] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createIntervention.mutate(
      {
        type,
        assetId: assetId || undefined,
        roomId: roomId || undefined,
        maintenanceRequestId: maintenanceRequestId || undefined,
        scheduledDate: scheduledDate || undefined,
        cost: cost ? Number(cost) : undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Planifier une intervention</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mi-hotel">Hôtel</Label>
          <select
            id="mi-hotel"
            required
            value={hotelId}
            onChange={(event) => setHotelId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Sélectionner un hôtel
            </option>
            {hotelOptions.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mi-type">Type</Label>
          <select
            id="mi-type"
            value={type}
            onChange={(event) => setType(event.target.value as MaintenanceInterventionType)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {(Object.keys(INTERVENTION_TYPE_LABELS) as MaintenanceInterventionType[]).map((value) => (
              <option key={value} value={value}>
                {INTERVENTION_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mi-scheduled">Date planifiée (optionnel)</Label>
          <Input
            id="mi-scheduled"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mi-asset">Équipement (optionnel)</Label>
          <select
            id="mi-asset"
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucun</option>
            {assetOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mi-room">Chambre (optionnel)</Label>
          <select
            id="mi-room"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucune</option>
            {roomOptions.map((room) => (
              <option key={room.id} value={room.id}>
                {room.number}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mi-request">Demande liée (optionnel)</Label>
          <select
            id="mi-request"
            value={maintenanceRequestId}
            onChange={(event) => setMaintenanceRequestId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucune</option>
            {requestOptions.map((request) => (
              <option key={request.id} value={request.id}>
                {request.description}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mi-cost">Coût estimé (optionnel, GNF)</Label>
          <Input id="mi-cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>

      {createIntervention.isError ? (
        <p className="text-sm text-destructive">
          {createIntervention.error instanceof Error ? createIntervention.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createIntervention.isPending}>
          {createIntervention.isPending ? "Création…" : "Planifier"}
        </Button>
      </DialogFooter>
    </form>
  );
}
