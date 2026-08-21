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
  Skeleton,
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import type { Department } from "../../services/departments.js";
import type { Role } from "../../services/roles.js";
import type { User } from "../../services/users.js";
import { useCreateDepartment, useDepartments, useUpdateDepartment } from "../../hooks/use-departments.js";
import { useCreateHotel, useCurrentHotel, useHotels } from "../../hooks/use-hotels.js";
import { usePermission } from "../../hooks/use-permission.js";
import { useAssignableRoles } from "../../hooks/use-roles.js";
import { useAddHotelMembership, useCreateUser, useRemoveHotelMembership, useUsers } from "../../hooks/use-users.js";
import { useAuthStore } from "../../stores/auth-store.js";

// Référence de branchement complet (Phase 14) : aucun département n'est imposé à la création d'un
// hôtel (voir apps/api HotelsService.create() — createDefaultDepartment est un choix explicite, pas
// un comportement caché). C'est l'utilisateur qui configure ses propres départements ici, un par
// un, via de vrais appels API — jamais de liste fictive.
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <HotelInfoCard />
      <UsersCard />
      <DepartmentsCard />
    </div>
  );
}

function HotelInfoCard() {
  const user = useAuthStore((s) => s.user);
  const hotel = useCurrentHotel();
  // RBAC multi-hôtel : `!user.hotel` ne distingue plus "gère le portefeuille d'hôtels" de
  // "hôtel-scopé" — un BOSS a désormais toujours un hôtel actif (HotelMembership), jamais
  // `hotel: null`. Le vrai critère est la permission `hotels.create` (portée organisationnelle),
  // pas la nullité de l'hôtel actif.
  const canManageHotels = usePermission("hotels.create");

  if (canManageHotels) {
    return <OrganizationHotelsCard />;
  }

  if (!user?.hotel) {
    return null;
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

// Vue de gestion du portefeuille d'hôtels (BOSS via `hotels.create`, ou SUPER_ADMIN sans hôtel
// unique) — liste les hôtels réels de l'organisation et permet d'en créer un nouveau. Le
// changement de contexte de travail actif se fait désormais via HotelSwitcher (header) — cette
// carte reste pour la gestion du portefeuille (créer/consulter), pas pour choisir l'hôtel actif.
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

// RBAC multi-hôtel (audit RBAC multi-hôtel, correctif création d'utilisateurs) — première UI pour
// créer un vrai membre d'équipe avec un rôle métier réellement rattaché via HotelMembership (voir
// UsersService.create()). Le sélecteur d'hôtel ne s'affiche que pour un demandeur org-wide
// (SUPER_ADMIN) : un demandeur hôtel-scopé (DIRECTEUR_HOTEL, ou BOSS actif sur un hôtel donné) crée
// toujours pour l'hôtel actif de sa propre session — même convention que CreateDepartmentForm.
function UsersCard() {
  const canViewUsers = usePermission("users.view");
  const canCreateUsers = usePermission("users.create");
  const authUser = useAuthStore((s) => s.user);
  const users = useUsers();
  const roles = useAssignableRoles();
  const hotels = useHotels();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageUserId, setManageUserId] = useState<string | null>(null);

  if (!canViewUsers) return null;

  const manageTarget = users.data?.find((u) => u.id === manageUserId) ?? null;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Équipe</CardTitle>
          {canCreateUsers ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Icons.IconPlus />
                  Nouvel utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent>
                <CreateUserForm
                  hotelOptions={!authUser?.hotel ? (hotels.data ?? []) : []}
                  roleOptions={roles.data ?? []}
                  onDone={() => setCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={users.isLoading}
            error={users.error}
            data={users.data}
            onRetry={() => users.refetch()}
            isEmpty={(data) => data.length === 0}
            emptyTitle="Aucun utilisateur"
            emptyDescription="Ajoutez le premier membre de votre équipe."
            emptyAction={
              canCreateUsers ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Icons.IconPlus />
                  Nouvel utilisateur
                </Button>
              ) : undefined
            }
          >
            {(data) => {
              const columns: DataTableColumn<User>[] = [
                {
                  id: "name",
                  header: "Nom",
                  sortValue: (u) => `${u.lastName} ${u.firstName}`.toLowerCase(),
                  cell: (u) => (
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-[var(--fw-subtitle-strong)] text-sm">
                          {u.firstName} {u.lastName}
                        </span>
                        {!u.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  ),
                },
                {
                  id: "memberships",
                  header: "Hôtels & rôles",
                  cell: (u) =>
                    u.hotelMemberships.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.hotelMemberships.map((m) => (
                          <Badge key={m.hotelId} variant="secondary">
                            {m.hotelName} · {m.roleName}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Aucun accès métier</span>
                    ),
                },
                {
                  id: "actions",
                  header: "",
                  align: "right",
                  cell: (u) =>
                    canCreateUsers ? (
                      <Button variant="outline" size="sm" onClick={() => setManageUserId(u.id)}>
                        Gérer les accès
                      </Button>
                    ) : null,
                },
              ];
              return (
                <DataTable
                  columns={columns}
                  data={data}
                  getRowId={(u) => u.id}
                  searchableText={(u) => `${u.firstName} ${u.lastName} ${u.email}`}
                  searchPlaceholder="Rechercher un utilisateur (nom, email)…"
                  emptyMessage="Aucun utilisateur ne correspond à cette recherche."
                />
              );
            }}
          </QueryState>
        </CardContent>
      </Card>

      <Dialog open={manageTarget !== null} onOpenChange={(open) => !open && setManageUserId(null)}>
        <DialogContent>
          {manageTarget ? (
            <ManageUserAccessForm
              target={manageTarget}
              hotelOptions={!authUser?.hotel ? (hotels.data ?? []) : []}
              roleOptions={roles.data ?? []}
              onDone={() => setManageUserId(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateUserForm({
  hotelOptions,
  roleOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  roleOptions: Role[];
  onDone: () => void;
}) {
  const createUser = useCreateUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [roleId, setRoleId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!roleId) return;
    createUser.mutate(
      { email, password, firstName, lastName, hotelId: hotelId || undefined, roleId },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouvel utilisateur</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-hotel">Hôtel</Label>
          <select
            id="user-hotel"
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
          <Label htmlFor="user-first-name">Prénom</Label>
          <Input id="user-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-last-name">Nom</Label>
          <Input id="user-last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-email">Email</Label>
        <Input id="user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-password">Mot de passe initial</Label>
        <Input
          id="user-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          8 caractères minimum — communiquez-le à la personne concernée par un canal sûr. Elle pourra le changer
          via "Mot de passe oublié" une fois connectée.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-role">Rôle</Label>
        <select
          id="user-role"
          required
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner un rôle
          </option>
          {roleOptions.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      {createUser.isError ? (
        <p className="text-sm text-destructive">
          {createUser.error instanceof Error ? createUser.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createUser.isPending}>
          {createUser.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ManageUserAccessForm({
  target,
  hotelOptions,
  roleOptions,
  onDone,
}: {
  target: User;
  hotelOptions: { id: string; name: string }[];
  roleOptions: Role[];
  onDone: () => void;
}) {
  const addMembership = useAddHotelMembership();
  const removeMembership = useRemoveHotelMembership();
  const [hotelId, setHotelId] = useState("");
  const [roleId, setRoleId] = useState("");

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const targetHotelId = hotelId || target.hotelId;
    if (!targetHotelId || !roleId) return;
    addMembership.mutate(
      { userId: target.id, hotelId: targetHotelId, roleId },
      { onSuccess: () => setRoleId("") }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>
          Accès de {target.firstName} {target.lastName}
        </DialogTitle>
      </DialogHeader>

      {target.hotelMemberships.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {target.hotelMemberships.map((m) => (
            <li key={m.hotelId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {m.hotelName} — {m.roleName}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={removeMembership.isPending}
                onClick={() => removeMembership.mutate({ userId: target.id, hotelId: m.hotelId })}
              >
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun accès métier actif.</p>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-sm font-[var(--fw-subtitle-strong)]">Ajouter ou modifier un accès</p>

        {hotelOptions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="membership-hotel">Hôtel</Label>
            <select
              id="membership-hotel"
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
          <Label htmlFor="membership-role">Rôle</Label>
          <select
            id="membership-role"
            required
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Sélectionner un rôle
            </option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        {addMembership.isError ? (
          <p className="text-sm text-destructive">
            {addMembership.error instanceof Error ? addMembership.error.message : "Erreur inattendue."}
          </p>
        ) : null}

        <Button type="submit" size="sm" disabled={addMembership.isPending} className="self-start">
          {addMembership.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Fermer
        </Button>
      </DialogFooter>
    </div>
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
          {(data) => {
            const columns: DataTableColumn<Department>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (department) => department.name.toLowerCase(),
                cell: (department) => (
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
                ),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (department) => (
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
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(department) => department.id}
                searchableText={(department) => `${department.name} ${department.code ?? ""}`}
                searchPlaceholder="Rechercher un département…"
                emptyMessage="Aucun département ne correspond à cette recherche."
              />
            );
          }}
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
