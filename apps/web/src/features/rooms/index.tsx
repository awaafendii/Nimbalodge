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
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useHotels } from "../../hooks/use-hotels.js";
import { useCreateRoomType, useRoomTypes, useUpdateRoomType } from "../../hooks/use-room-types.js";
import { useCreateRoom, useRooms, useUpdateRoom } from "../../hooks/use-rooms.js";
import type { RoomType } from "../../services/room-types.js";
import type { Room } from "../../services/rooms.js";
import { useAuthStore } from "../../stores/auth-store.js";

// Référence de branchement (Étape 4, module 2/11) : Types de chambres avant Chambres (une chambre
// référence toujours un type déjà créé, comme Département avant Activité en Phase 4).
export default function RoomsPage() {
  return (
    <div className="flex flex-col gap-5">
      <RoomTypesCard />
      <RoomsCard />
    </div>
  );
}

function RoomTypesCard() {
  const user = useAuthStore((s) => s.user);
  const roomTypes = useRoomTypes();
  const updateRoomType = useUpdateRoomType();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Types de chambres</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Ajouter un type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateRoomTypeForm
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={roomTypes.isLoading}
          error={roomTypes.error}
          data={roomTypes.data}
          onRetry={() => roomTypes.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun type de chambre configuré"
          emptyDescription="Créez votre premier type de chambre (tarif, capacité) avant d'ajouter des chambres."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Ajouter un type
            </Button>
          }
        >
          {(data) => {
            const columns: DataTableColumn<RoomType>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (roomType) => roomType.name.toLowerCase(),
                cell: (roomType) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{roomType.name}</span>
                    {roomType.code ? <Badge variant="secondary">{roomType.code}</Badge> : null}
                    {!roomType.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                  </div>
                ),
              },
              {
                id: "baseRate",
                header: "Tarif de base",
                align: "right",
                sortValue: (roomType) => Number(roomType.baseRate),
                cell: (roomType) => fmtGNF(Number(roomType.baseRate)),
              },
              {
                id: "capacity",
                header: "Capacité",
                align: "right",
                sortValue: (roomType) => roomType.capacity ?? 0,
                cell: (roomType) => (roomType.capacity ? `${roomType.capacity} pers.` : "—"),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (roomType) => (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateRoomType.isPending}
                    onClick={() =>
                      updateRoomType.mutate({ id: roomType.id, input: { isActive: !roomType.isActive } })
                    }
                  >
                    {roomType.isActive ? "Désactiver" : "Réactiver"}
                  </Button>
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(roomType) => roomType.id}
                searchableText={(roomType) => `${roomType.name} ${roomType.code ?? ""}`}
                searchPlaceholder="Rechercher un type de chambre…"
                emptyMessage="Aucun type de chambre ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateRoomTypeForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createRoomType = useCreateRoomType();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name || !baseRate) return;
    createRoomType.mutate(
      {
        name,
        code: code || undefined,
        baseRate: Number(baseRate),
        capacity: capacity ? Number(capacity) : undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un type de chambre</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-type-hotel">Hôtel</Label>
          <select
            id="room-type-hotel"
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
        <Label htmlFor="room-type-name">Nom</Label>
        <Input id="room-type-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-type-code">Code (optionnel)</Label>
          <Input id="room-type-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-type-capacity">Capacité (optionnel)</Label>
          <Input
            id="room-type-capacity"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="room-type-base-rate">Tarif de base (GNF)</Label>
        <Input
          id="room-type-base-rate"
          type="number"
          min={0}
          step="0.01"
          required
          value={baseRate}
          onChange={(e) => setBaseRate(e.target.value)}
        />
      </div>

      {createRoomType.isError ? (
        <p className="text-sm text-destructive">
          {createRoomType.error instanceof Error ? createRoomType.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createRoomType.isPending}>
          {createRoomType.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RoomsCard() {
  const user = useAuthStore((s) => s.user);
  const rooms = useRooms();
  const roomTypes = useRoomTypes();
  const updateRoom = useUpdateRoom();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  const roomTypeNameById = new Map((roomTypes.data ?? []).map((roomType) => [roomType.id, roomType.name]));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Chambres</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={(roomTypes.data ?? []).length === 0}>
              <Icons.IconPlus />
              Ajouter une chambre
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateRoomForm
              roomTypeOptions={roomTypes.data ?? []}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={rooms.isLoading}
          error={rooms.error}
          data={rooms.data}
          onRetry={() => rooms.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune chambre configurée"
          emptyDescription={
            (roomTypes.data ?? []).length === 0
              ? "Créez d'abord un type de chambre ci-dessus."
              : "Ajoutez votre première chambre pour commencer à gérer votre inventaire."
          }
          emptyAction={
            (roomTypes.data ?? []).length > 0 ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Icons.IconPlus />
                Ajouter une chambre
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<Room>[] = [
              {
                id: "number",
                header: "Numéro",
                sortValue: (room) => room.number,
                cell: (room) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{room.number}</span>
                    {!room.isActive ? <Badge variant="outline">Désactivée</Badge> : null}
                  </div>
                ),
              },
              {
                id: "type",
                header: "Type",
                sortValue: (room) => roomTypeNameById.get(room.roomTypeId) ?? "",
                cell: (room) => roomTypeNameById.get(room.roomTypeId) ?? "—",
              },
              {
                id: "location",
                header: "Emplacement",
                cell: (room) =>
                  room.floor || room.building
                    ? [room.building, room.floor ? `Étage ${room.floor}` : null].filter(Boolean).join(" · ")
                    : "—",
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (room) => (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateRoom.isPending}
                    onClick={() => updateRoom.mutate({ id: room.id, input: { isActive: !room.isActive } })}
                  >
                    {room.isActive ? "Désactiver" : "Réactiver"}
                  </Button>
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(room) => room.id}
                searchableText={(room) => `${room.number} ${roomTypeNameById.get(room.roomTypeId) ?? ""}`}
                searchPlaceholder="Rechercher une chambre (numéro, type)…"
                emptyMessage="Aucune chambre ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateRoomForm({
  roomTypeOptions,
  hotelOptions,
  onDone,
}: {
  roomTypeOptions: RoomType[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createRoom = useCreateRoom();
  const [roomTypeId, setRoomTypeId] = useState("");
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [building, setBuilding] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!roomTypeId || !number) return;
    createRoom.mutate(
      {
        roomTypeId,
        number,
        floor: floor || undefined,
        building: building || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter une chambre</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-hotel">Hôtel</Label>
          <select
            id="room-hotel"
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
        <Label htmlFor="room-type-id">Type de chambre</Label>
        <select
          id="room-type-id"
          required
          value={roomTypeId}
          onChange={(event) => setRoomTypeId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner un type
          </option>
          {roomTypeOptions.map((roomType) => (
            <option key={roomType.id} value={roomType.id}>
              {roomType.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="room-number">Numéro</Label>
        <Input id="room-number" required value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-floor">Étage (optionnel)</Label>
          <Input id="room-floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-building">Bâtiment (optionnel)</Label>
          <Input id="room-building" value={building} onChange={(e) => setBuilding(e.target.value)} />
        </div>
      </div>

      {createRoom.isError ? (
        <p className="text-sm text-destructive">
          {createRoom.error instanceof Error ? createRoom.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createRoom.isPending}>
          {createRoom.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
