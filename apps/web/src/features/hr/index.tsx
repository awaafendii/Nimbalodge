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
import { useAttendance, useClockOutAttendance, useCreateAttendance } from "../../hooks/use-attendance.js";
import { useDepartments } from "../../hooks/use-departments.js";
import { useCreateEmployee, useEmployees, useUpdateEmployee } from "../../hooks/use-employees.js";
import { useHotels } from "../../hooks/use-hotels.js";
import { usePermission } from "../../hooks/use-permission.js";
import {
  useApproveLeaveRequest,
  useCancelLeaveRequest,
  useCreateLeaveRequest,
  useLeaveRequests,
  useRejectLeaveRequest,
} from "../../hooks/use-leave-requests.js";
import type { Attendance } from "../../services/attendance.js";
import type { Employee } from "../../services/employees.js";
import type { LeaveRequest } from "../../services/leave-requests.js";
import { useAuthStore } from "../../stores/auth-store.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// Référence de branchement (Étape 4, module 4/11) : "Employés, contrats, présence, congés"
// (subtitle nav-config.tsx) — trois ressources Phase 8 (Employee/Attendance/LeaveRequest) sur un
// seul écran, WorkSchedule laissé pour une itération ultérieure (non nommé dans le subtitle nav).
export default function HrPage() {
  return (
    <div className="flex flex-col gap-5">
      <EmployeesCard />
      <LeaveRequestsCard />
      <AttendanceCard />
    </div>
  );
}

function EmployeesCard() {
  const user = useAuthStore((s) => s.user);
  const employees = useEmployees();
  const updateEmployee = useUpdateEmployee();
  const departments = useDepartments();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  const departmentNameById = new Map((departments.data ?? []).map((department) => [department.id, department.name]));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Employés</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Ajouter un employé
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateEmployeeForm
              departmentOptions={departments.data ?? []}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={employees.isLoading}
          error={employees.error}
          data={employees.data}
          onRetry={() => employees.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun employé enregistré"
          emptyDescription="Ajoutez votre premier employé pour commencer à gérer votre personnel."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Ajouter un employé
            </Button>
          }
        >
          {(data) => {
            const columns: DataTableColumn<Employee>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (employee) => `${employee.lastName} ${employee.firstName}`.toLowerCase(),
                cell: (employee) => (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-[var(--fw-subtitle-strong)] text-sm">
                        {employee.lastName} {employee.firstName}
                      </span>
                      {!employee.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                    </div>
                    {employee.position ? <p className="truncate text-xs text-muted-foreground">{employee.position}</p> : null}
                  </div>
                ),
              },
              {
                id: "department",
                header: "Département",
                cell: (employee) =>
                  employee.departmentId ? (departmentNameById.get(employee.departmentId) ?? "—") : "—",
              },
              {
                id: "salary",
                header: "Salaire de base",
                align: "right",
                sortValue: (employee) => Number(employee.baseSalary),
                cell: (employee) => fmtGNF(Number(employee.baseSalary)),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (employee) => (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateEmployee.isPending}
                    onClick={() =>
                      updateEmployee.mutate({ id: employee.id, input: { isActive: !employee.isActive } })
                    }
                  >
                    {employee.isActive ? "Désactiver" : "Réactiver"}
                  </Button>
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(employee) => employee.id}
                searchableText={(employee) => `${employee.firstName} ${employee.lastName} ${employee.position ?? ""}`}
                searchPlaceholder="Rechercher un employé…"
                emptyMessage="Aucun employé ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateEmployeeForm({
  departmentOptions,
  hotelOptions,
  onDone,
}: {
  departmentOptions: { id: string; name: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createEmployee = useCreateEmployee();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firstName || !lastName || !baseSalary) return;
    createEmployee.mutate(
      {
        firstName,
        lastName,
        baseSalary: Number(baseSalary),
        position: position || undefined,
        departmentId: departmentId || undefined,
        email: email || undefined,
        phone: phone || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un employé</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-hotel">Hôtel</Label>
          <select
            id="employee-hotel"
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
          <Label htmlFor="employee-first-name">Prénom</Label>
          <Input id="employee-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-last-name">Nom</Label>
          <Input id="employee-last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-position">Poste (optionnel)</Label>
          <Input id="employee-position" value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-department">Département (optionnel)</Label>
          <select
            id="employee-department"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucun</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employee-base-salary">Salaire de base (GNF)</Label>
        <Input
          id="employee-base-salary"
          type="number"
          min={0}
          step="0.01"
          required
          value={baseSalary}
          onChange={(e) => setBaseSalary(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-email">Email (optionnel)</Label>
          <Input id="employee-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-phone">Téléphone (optionnel)</Label>
          <Input id="employee-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      {createEmployee.isError ? (
        <p className="text-sm text-destructive">
          {createEmployee.error instanceof Error ? createEmployee.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createEmployee.isPending}>
          {createEmployee.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LeaveRequestsCard() {
  const user = useAuthStore((s) => s.user);
  const leaveRequests = useLeaveRequests();
  const employees = useEmployees();
  const hotels = useHotels();
  const approve = useApproveLeaveRequest();
  const reject = useRejectLeaveRequest();
  const cancel = useCancelLeaveRequest();
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCreate = usePermission("leave-requests.create");
  const canApprove = usePermission("leave-requests.approve");
  const canReject = usePermission("leave-requests.reject");
  const canCancel = usePermission("leave-requests.cancel");

  const employeeNameById = new Map(
    (employees.data ?? []).map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`])
  );
  const anyPending = approve.isPending || reject.isPending || cancel.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Congés</CardTitle>
        {canCreate ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={(employees.data ?? []).length === 0}>
                <Icons.IconPlus />
                Nouvelle demande
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateLeaveRequestForm
                employeeOptions={employees.data ?? []}
                hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
                onDone={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={leaveRequests.isLoading}
          error={leaveRequests.error}
          data={leaveRequests.data}
          onRetry={() => leaveRequests.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune demande de congé"
          emptyDescription={
            (employees.data ?? []).length === 0
              ? "Ajoutez d'abord un employé ci-dessus."
              : "Créez votre première demande de congé."
          }
          emptyAction={
            canCreate && (employees.data ?? []).length > 0 ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Icons.IconPlus />
                Nouvelle demande
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<LeaveRequest>[] = [
              {
                id: "employee",
                header: "Employé",
                sortValue: (leaveRequest) => employeeNameById.get(leaveRequest.employeeId) ?? "",
                cell: (leaveRequest) => employeeNameById.get(leaveRequest.employeeId) ?? "—",
              },
              {
                id: "period",
                header: "Période",
                sortValue: (leaveRequest) => leaveRequest.startDate,
                cell: (leaveRequest) => (
                  <div className="text-sm">
                    <p>
                      {formatDate(leaveRequest.startDate)} → {formatDate(leaveRequest.endDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {leaveRequest.days} jour{leaveRequest.days > 1 ? "s" : ""}
                      {leaveRequest.type ? ` · ${leaveRequest.type}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                id: "status",
                header: "Statut",
                cell: (leaveRequest) => <StatusBadge status={leaveRequest.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (leaveRequest) =>
                  leaveRequest.status === "PENDING" &&
                  (canApprove || canReject || canCancel) ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {canApprove ? (
                        <Button size="sm" disabled={anyPending} onClick={() => approve.mutate(leaveRequest.id)}>
                          Approuver
                        </Button>
                      ) : null}
                      {canReject ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyPending}
                          onClick={() => reject.mutate(leaveRequest.id)}
                        >
                          Rejeter
                        </Button>
                      ) : null}
                      {canCancel ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={anyPending}
                          onClick={() => cancel.mutate(leaveRequest.id)}
                        >
                          Annuler
                        </Button>
                      ) : null}
                    </div>
                  ) : null,
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(leaveRequest) => leaveRequest.id}
                searchableText={(leaveRequest) => employeeNameById.get(leaveRequest.employeeId) ?? ""}
                searchPlaceholder="Rechercher par employé…"
                emptyMessage="Aucune demande ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateLeaveRequestForm({
  employeeOptions,
  hotelOptions,
  onDone,
}: {
  employeeOptions: { id: string; firstName: string; lastName: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createLeaveRequest = useCreateLeaveRequest();
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!employeeId || !startDate || !endDate) return;
    createLeaveRequest.mutate(
      {
        employeeId,
        startDate,
        endDate,
        type: type || undefined,
        reason: reason || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouvelle demande de congé</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-hotel">Hôtel</Label>
          <select
            id="leave-hotel"
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
        <Label htmlFor="leave-employee">Employé</Label>
        <select
          id="leave-employee"
          required
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner un employé
          </option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-start">Début</Label>
          <Input id="leave-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leave-end">Fin</Label>
          <Input id="leave-end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="leave-type">Type (optionnel)</Label>
        <Input id="leave-type" placeholder="Congé annuel, maladie…" value={type} onChange={(e) => setType(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="leave-reason">Motif (optionnel)</Label>
        <Textarea id="leave-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>

      {createLeaveRequest.isError ? (
        <p className="text-sm text-destructive">
          {createLeaveRequest.error instanceof Error ? createLeaveRequest.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createLeaveRequest.isPending}>
          {createLeaveRequest.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AttendanceCard() {
  const user = useAuthStore((s) => s.user);
  const attendance = useAttendance();
  const employees = useEmployees();
  const hotels = useHotels();
  const clockOut = useClockOutAttendance();
  const [dialogOpen, setDialogOpen] = useState(false);

  const employeeNameById = new Map(
    (employees.data ?? []).map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`])
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Présence</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={(employees.data ?? []).length === 0}>
              <Icons.IconPlus />
              Pointer une arrivée
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateAttendanceForm
              employeeOptions={employees.data ?? []}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={attendance.isLoading}
          error={attendance.error}
          data={attendance.data}
          onRetry={() => attendance.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun pointage enregistré"
          emptyDescription={
            (employees.data ?? []).length === 0
              ? "Ajoutez d'abord un employé ci-dessus."
              : "Pointez la première arrivée pour commencer le suivi de présence."
          }
          emptyAction={
            (employees.data ?? []).length > 0 ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Icons.IconPlus />
                Pointer une arrivée
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<Attendance>[] = [
              {
                id: "employee",
                header: "Employé",
                sortValue: (record) => employeeNameById.get(record.employeeId) ?? "",
                cell: (record) => employeeNameById.get(record.employeeId) ?? "—",
              },
              {
                id: "clockIn",
                header: "Arrivée",
                sortValue: (record) => record.clockIn,
                cell: (record) => formatDateTime(record.clockIn),
              },
              {
                id: "clockOut",
                header: "Départ",
                cell: (record) => (record.clockOut ? formatDateTime(record.clockOut) : "—"),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (record) =>
                  !record.clockOut ? (
                    <Button size="sm" disabled={clockOut.isPending} onClick={() => clockOut.mutate(record.id)}>
                      Pointer le départ
                    </Button>
                  ) : null,
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(record) => record.id}
                searchableText={(record) => employeeNameById.get(record.employeeId) ?? ""}
                searchPlaceholder="Rechercher par employé…"
                emptyMessage="Aucun pointage ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateAttendanceForm({
  employeeOptions,
  hotelOptions,
  onDone,
}: {
  employeeOptions: { id: string; firstName: string; lastName: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createAttendance = useCreateAttendance();
  const [employeeId, setEmployeeId] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!employeeId) return;
    createAttendance.mutate({ employeeId, hotelId: hotelId || undefined }, { onSuccess: () => onDone() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Pointer une arrivée</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-hotel">Hôtel</Label>
          <select
            id="attendance-hotel"
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
        <Label htmlFor="attendance-employee">Employé</Label>
        <select
          id="attendance-employee"
          required
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner un employé
          </option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        L'heure d'arrivée est enregistrée au moment de la validation.
      </p>

      {createAttendance.isError ? (
        <p className="text-sm text-destructive">
          {createAttendance.error instanceof Error ? createAttendance.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createAttendance.isPending}>
          {createAttendance.isPending ? "Enregistrement…" : "Pointer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
