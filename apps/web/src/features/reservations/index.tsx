import { useState, type FormEvent } from "react";
import { fmtGNF } from "@nimbalodge/utils";
import {
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
import { useGuests } from "../../hooks/use-guests.js";
import { useHotels } from "../../hooks/use-hotels.js";
import {
  useCancelReservation,
  useCheckInReservation,
  useCheckOutReservation,
  useConfirmReservation,
  useCreateReservation,
  useNoShowReservation,
  useReservations,
} from "../../hooks/use-reservations.js";
import { useAvailableRooms, useRooms } from "../../hooks/use-rooms.js";
import { useRoomTypes } from "../../hooks/use-room-types.js";
import type { Reservation } from "../../services/reservations.js";
import { useAuthStore } from "../../stores/auth-store.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Référence de branchement (Étape 4, module 3/11) : le plus complexe des 11 — cycle de vie à 6
// statuts (Phase 7) avec des actions contextuelles par statut plutôt qu'un simple bascule
// actif/inactif. Room/RoomTypes (module 2/11) et Guests (module 1/11) sont des dépendances
// directes du formulaire de création — d'où leur ordre dans le Master Prompt §54.
export default function ReservationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <ReservationsCard />
    </div>
  );
}

function ReservationsCard() {
  const user = useAuthStore((s) => s.user);
  const reservations = useReservations();
  const guests = useGuests();
  const rooms = useRooms();
  const roomTypes = useRoomTypes();
  const hotels = useHotels();
  const confirm = useConfirmReservation();
  const checkIn = useCheckInReservation();
  const checkOut = useCheckOutReservation();
  const cancel = useCancelReservation();
  const noShow = useNoShowReservation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const guestNameById = new Map((guests.data ?? []).map((guest) => [guest.id, `${guest.firstName} ${guest.lastName}`]));
  const roomById = new Map((rooms.data ?? []).map((room) => [room.id, room]));
  const roomTypeNameById = new Map((roomTypes.data ?? []).map((roomType) => [roomType.id, roomType.name]));

  const anyTransitionPending =
    confirm.isPending || checkIn.isPending || checkOut.isPending || cancel.isPending || noShow.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Réservations</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={(guests.data ?? []).length === 0 || (rooms.data ?? []).length === 0}>
              <Icons.IconPlus />
              Nouvelle réservation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateReservationForm
              guestOptions={guests.data ?? []}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={reservations.isLoading}
          error={reservations.error}
          data={reservations.data}
          onRetry={() => reservations.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune réservation enregistrée"
          emptyDescription={
            (guests.data ?? []).length === 0
              ? "Ajoutez d'abord un client (module Clients)."
              : (rooms.data ?? []).length === 0
                ? "Ajoutez d'abord une chambre (module Chambres)."
                : "Créez votre première réservation."
          }
          emptyAction={
            (guests.data ?? []).length > 0 && (rooms.data ?? []).length > 0 ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Icons.IconPlus />
                Nouvelle réservation
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<Reservation>[] = [
              {
                id: "guest",
                header: "Client",
                sortValue: (reservation) => guestNameById.get(reservation.guestId) ?? "",
                cell: (reservation) => (
                  <span className="font-[var(--fw-subtitle-strong)] text-sm">
                    {guestNameById.get(reservation.guestId) ?? "—"}
                  </span>
                ),
              },
              {
                id: "room",
                header: "Chambre",
                cell: (reservation) => {
                  const room = roomById.get(reservation.roomId);
                  return room ? `${room.number} — ${roomTypeNameById.get(room.roomTypeId) ?? "—"}` : "—";
                },
              },
              {
                id: "stay",
                header: "Séjour",
                sortValue: (reservation) => reservation.checkInDate,
                cell: (reservation) => (
                  <div className="text-sm">
                    <p>
                      {formatDate(reservation.checkInDate)} → {formatDate(reservation.checkOutDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reservation.nights} nuit{reservation.nights > 1 ? "s" : ""} · {reservation.adults} adulte
                      {reservation.adults > 1 ? "s" : ""}
                      {reservation.children > 0 ? `, ${reservation.children} enfant(s)` : ""}
                    </p>
                  </div>
                ),
              },
              {
                id: "amount",
                header: "Montant estimé",
                align: "right",
                sortValue: (reservation) => Number(reservation.estimatedAmount),
                cell: (reservation) => fmtGNF(Number(reservation.estimatedAmount)),
              },
              {
                id: "status",
                header: "Statut",
                cell: (reservation) => <StatusBadge status={reservation.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (reservation) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    {reservation.status === "PENDING" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={anyTransitionPending}
                          onClick={() => confirm.mutate({ id: reservation.id })}
                        >
                          Confirmer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyTransitionPending}
                          onClick={() => cancel.mutate({ id: reservation.id })}
                        >
                          Annuler
                        </Button>
                      </>
                    ) : null}
                    {reservation.status === "CONFIRMED" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={anyTransitionPending}
                          onClick={() => checkIn.mutate({ id: reservation.id })}
                        >
                          Check-in
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyTransitionPending}
                          onClick={() => noShow.mutate({ id: reservation.id })}
                        >
                          No-show
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyTransitionPending}
                          onClick={() => cancel.mutate({ id: reservation.id })}
                        >
                          Annuler
                        </Button>
                      </>
                    ) : null}
                    {reservation.status === "CHECKED_IN" ? (
                      <Button
                        size="sm"
                        disabled={anyTransitionPending}
                        onClick={() => checkOut.mutate({ id: reservation.id })}
                      >
                        Check-out
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
                getRowId={(reservation) => reservation.id}
                searchableText={(reservation) => guestNameById.get(reservation.guestId) ?? ""}
                searchPlaceholder="Rechercher par client…"
                emptyMessage="Aucune réservation ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateReservationForm({
  guestOptions,
  hotelOptions,
  onDone,
}: {
  guestOptions: { id: string; firstName: string; lastName: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createReservation = useCreateReservation();
  const roomTypes = useRoomTypes();
  const [hotelId, setHotelId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [roomId, setRoomId] = useState("");
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("");
  const [notes, setNotes] = useState("");

  const roomTypeNameById = new Map((roomTypes.data ?? []).map((roomType) => [roomType.id, roomType.name]));
  const availableRooms = useAvailableRooms(checkInDate, checkOutDate);
  const roomOptions = (availableRooms.data ?? []).filter((room) => !hotelId || room.hotelId === hotelId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!guestId || !roomId || !checkInDate || !checkOutDate) return;
    createReservation.mutate(
      {
        guestId,
        roomId,
        checkInDate,
        checkOutDate,
        adults: adults ? Number(adults) : undefined,
        children: children ? Number(children) : undefined,
        notes: notes || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouvelle réservation</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reservation-hotel">Hôtel</Label>
          <select
            id="reservation-hotel"
            required
            value={hotelId}
            onChange={(event) => {
              setHotelId(event.target.value);
              setRoomId("");
            }}
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
        <Label htmlFor="reservation-guest">Client</Label>
        <select
          id="reservation-guest"
          required
          value={guestId}
          onChange={(event) => setGuestId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner un client
          </option>
          {guestOptions.map((guest) => (
            <option key={guest.id} value={guest.id}>
              {guest.firstName} {guest.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reservation-check-in">Arrivée</Label>
          <Input
            id="reservation-check-in"
            type="date"
            required
            value={checkInDate}
            onChange={(event) => {
              setCheckInDate(event.target.value);
              setRoomId("");
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reservation-check-out">Départ</Label>
          <Input
            id="reservation-check-out"
            type="date"
            required
            value={checkOutDate}
            onChange={(event) => {
              setCheckOutDate(event.target.value);
              setRoomId("");
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reservation-room">Chambre disponible</Label>
        <select
          id="reservation-room"
          required
          disabled={!checkInDate || !checkOutDate}
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            {!checkInDate || !checkOutDate
              ? "Choisir d'abord les dates"
              : availableRooms.isLoading
                ? "Chargement…"
                : roomOptions.length === 0
                  ? "Aucune chambre disponible pour ces dates"
                  : "Sélectionner une chambre"}
          </option>
          {roomOptions.map((room) => (
            <option key={room.id} value={room.id}>
              {room.number} — {roomTypeNameById.get(room.roomTypeId) ?? "—"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reservation-adults">Adultes</Label>
          <Input
            id="reservation-adults"
            type="number"
            min={1}
            required
            value={adults}
            onChange={(event) => setAdults(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reservation-children">Enfants (optionnel)</Label>
          <Input
            id="reservation-children"
            type="number"
            min={0}
            value={children}
            onChange={(event) => setChildren(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reservation-notes">Notes (optionnel)</Label>
        <Textarea id="reservation-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      {createReservation.isError ? (
        <p className="text-sm text-destructive">
          {createReservation.error instanceof Error ? createReservation.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createReservation.isPending}>
          {createReservation.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
