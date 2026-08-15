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
import { useCurrentHotel, useHotels } from "../../hooks/use-hotels.js";
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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Vue organisation ({user?.organization.name ?? "…"}) — aucun hôtel unique sélectionné.
          Le sélecteur multi-hôtel n'est pas encore construit.
        </CardContent>
      </Card>
    );
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
