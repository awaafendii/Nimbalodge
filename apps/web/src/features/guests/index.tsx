import { useState, type FormEvent } from "react";
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
import { useCreateGuest, useGuests, useUpdateGuest } from "../../hooks/use-guests.js";
import { useHotels } from "../../hooks/use-hotels.js";
import type { Guest } from "../../services/guests.js";
import { useAuthStore } from "../../stores/auth-store.js";

// Référence de branchement (Étape 4, module 1/11 — ordre §54 du Master Prompt) : même convention
// que Départements (Phase 14/Étape 1) — DataTable réel, formulaire de création minimal mais
// complet (identité + contact + document, ce qu'un hôtel doit réellement savoir d'un client),
// aucune donnée fictive.
export default function GuestsPage() {
  return (
    <div className="flex flex-col gap-5">
      <GuestsCard />
    </div>
  );
}

function GuestsCard() {
  const user = useAuthStore((s) => s.user);
  const guests = useGuests();
  const updateGuest = useUpdateGuest();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Clients</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Ajouter un client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateGuestForm
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={guests.isLoading}
          error={guests.error}
          data={guests.data}
          onRetry={() => guests.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun client enregistré"
          emptyDescription="Ajoutez votre premier client pour commencer à constituer votre fichier clients."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Ajouter un client
            </Button>
          }
        >
          {(data) => {
            const columns: DataTableColumn<Guest>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (guest) => `${guest.lastName} ${guest.firstName}`.toLowerCase(),
                cell: (guest) => (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-[var(--fw-subtitle-strong)] text-sm">
                        {guest.lastName} {guest.firstName}
                      </span>
                      {!guest.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                    </div>
                    {guest.nationality ? (
                      <p className="truncate text-xs text-muted-foreground">{guest.nationality}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "contact",
                header: "Contact",
                cell: (guest) => (
                  <div className="text-sm">
                    {guest.email ? <p className="truncate">{guest.email}</p> : null}
                    {guest.phone ? <p className="truncate text-muted-foreground">{guest.phone}</p> : null}
                    {!guest.email && !guest.phone ? <span className="text-muted-foreground">—</span> : null}
                  </div>
                ),
              },
              {
                id: "document",
                header: "Pièce d'identité",
                cell: (guest) =>
                  guest.documentType || guest.documentNumber ? (
                    <span className="text-sm">
                      {[guest.documentType, guest.documentNumber].filter(Boolean).join(" · ")}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  ),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (guest) => (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateGuest.isPending}
                    onClick={() => updateGuest.mutate({ id: guest.id, input: { isActive: !guest.isActive } })}
                  >
                    {guest.isActive ? "Désactiver" : "Réactiver"}
                  </Button>
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(guest) => guest.id}
                searchableText={(guest) =>
                  `${guest.firstName} ${guest.lastName} ${guest.email ?? ""} ${guest.phone ?? ""}`
                }
                searchPlaceholder="Rechercher un client (nom, email, téléphone)…"
                emptyMessage="Aucun client ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateGuestForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createGuest = useCreateGuest();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [nationality, setNationality] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firstName || !lastName) return;
    createGuest.mutate(
      {
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        documentType: documentType || undefined,
        documentNumber: documentNumber || undefined,
        nationality: nationality || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un client</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guest-hotel">Hôtel</Label>
          <select
            id="guest-hotel"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guest-first-name">Prénom</Label>
          <Input id="guest-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guest-last-name">Nom</Label>
          <Input id="guest-last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guest-email">Email (optionnel)</Label>
        <Input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guest-phone">Téléphone (optionnel)</Label>
        <Input id="guest-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guest-document-type">Type de pièce (optionnel)</Label>
          <Input
            id="guest-document-type"
            placeholder="Passeport, CNI…"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guest-document-number">Numéro (optionnel)</Label>
          <Input id="guest-document-number" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guest-nationality">Nationalité (optionnel)</Label>
        <Input id="guest-nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
      </div>

      {createGuest.isError ? (
        <p className="text-sm text-destructive">
          {createGuest.error instanceof Error ? createGuest.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createGuest.isPending}>
          {createGuest.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
