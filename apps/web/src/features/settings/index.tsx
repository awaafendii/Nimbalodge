import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Icons,
  Input,
  Label,
  Skeleton,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useCreateDepartment, useDepartments, useUpdateDepartment } from "../../hooks/use-departments.js";
import { useCreateHotel, useCurrentHotel, useHotels } from "../../hooks/use-hotels.js";
import { useAuthStore } from "../../stores/auth-store.js";

// Référence de branchement complet (Phase 14) : aucun département n'est imposé à la création d'un
// hôtel (voir apps/api HotelsService.create() — createDefaultDepartment est un choix explicite, pas
// un comportement caché). C'est l'utilisateur qui configure ses propres départements ici, un par
// un, via de vrais appels API — jamais de liste fictive.
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <HotelInfoCard />
      <DepartmentsCard />
    </div>
  );
}

function HotelInfoCard() {
  const user = useAuthStore((s) => s.user);
  const hotel = useCurrentHotel();

  if (!user?.hotel) {
    return <OrganizationHotelsCard />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hôtel</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={hotel.isLoading}
          error={hotel.error}
          data={hotel.data}
          onRetry={() => hotel.refetch()}
          renderLoading={() => <Skeleton className="h-16 w-full" />}
        >
          {(data) => (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Nom</dt>
                <dd>{data.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Adresse</dt>
                <dd>{data.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd>{data.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{data.email ?? "—"}</dd>
              </div>
            </dl>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

// Vue org-wide (SUPER_ADMIN sans hôtel unique, ex. juste après le bootstrap de production) — liste
// les hôtels réels de l'organisation et permet d'en créer un premier. Aucun sélecteur multi-hôtel
// pour basculer le contexte de travail (pas encore construit) : un SUPER_ADMIN agit déjà à travers
// tous les hôtels de son organisation, un hôtel précis se choisit au cas par cas (ex. le sélecteur
// d'hôtel du formulaire "Ajouter un département" ci-dessous).
function OrganizationHotelsCard() {
  const user = useAuthStore((s) => s.user);
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{user?.organization.name ?? "Organisation"}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Créer un hôtel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateHotelForm onDone={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={hotels.isLoading}
          error={hotels.error}
          data={hotels.data}
          onRetry={() => hotels.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun hôtel configuré"
          emptyDescription="Créez votre premier hôtel pour commencer à utiliser NimbaLodge."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Créer un hôtel
            </Button>
          }
        >
          {(data) => (
            <ul className="flex flex-col divide-y divide-border">
              {data.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="font-[var(--fw-subtitle-strong)]">{h.name}</span>
                  {!h.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateHotelForm({ onDone }: { onDone: () => void }) {
  const createHotel = useCreateHotel();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [createDefaultDepartment, setCreateDefaultDepartment] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      );
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name || !slug) return;
    createHotel.mutate(
      {
        name,
        slug,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        createDefaultDepartment,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Créer un hôtel</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hotel-name">Nom</Label>
        <Input id="hotel-name" required value={name} onChange={(event) => handleNameChange(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hotel-slug">Identifiant (slug, unique dans l'organisation)</Label>
        <Input
          id="hotel-slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hotel-address">Adresse (optionnel)</Label>
        <Input id="hotel-address" value={address} onChange={(event) => setAddress(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hotel-phone">Téléphone (optionnel)</Label>
        <Input id="hotel-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hotel-email">Email (optionnel)</Label>
        <Input id="hotel-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={createDefaultDepartment}
          onChange={(event) => setCreateDefaultDepartment(event.target.checked)}
        />
        Créer aussi un département "Administration générale"
      </label>

      {createHotel.isError ? (
        <p className="text-sm text-destructive">
          {createHotel.error instanceof Error ? createHotel.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createHotel.isPending}>
          {createHotel.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DepartmentsCard() {
  const user = useAuthStore((s) => s.user);
  const departments = useDepartments();
  const updateDepartment = useUpdateDepartment();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Départements</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Ajouter un département
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateDepartmentForm
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={departments.isLoading}
          error={departments.error}
          data={departments.data}
          onRetry={() => departments.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun département configuré"
          emptyDescription="Créez votre premier département pour commencer à organiser votre établissement."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Ajouter un département
            </Button>
          }
        >
          {(data) => (
            <ul className="flex flex-col divide-y divide-border">
              {data.map((department) => (
                <li key={department.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-[var(--fw-subtitle-strong)] text-sm">{department.name}</span>
                      {department.code ? <Badge variant="secondary">{department.code}</Badge> : null}
                      {!department.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                    </div>
                    {department.description ? (
                      <p className="truncate text-xs text-muted-foreground">{department.description}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateDepartment.isPending}
                    onClick={() =>
                      updateDepartment.mutate({ id: department.id, input: { isActive: !department.isActive } })
                    }
                  >
                    {department.isActive ? "Désactiver" : "Réactiver"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateDepartmentForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createDepartment = useCreateDepartment();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createDepartment.mutate(
      {
        name,
        code: code || undefined,
        description: description || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un département</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hotelId">Hôtel</Label>
          <select
            id="hotelId"
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
        <Label htmlFor="name">Nom</Label>
        <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Code (optionnel)</Label>
        <Input id="code" value={code} onChange={(event) => setCode(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Input id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>

      {createDepartment.isError ? (
        <p className="text-sm text-destructive">
          {createDepartment.error instanceof Error ? createDepartment.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createDepartment.isPending}>
          {createDepartment.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
