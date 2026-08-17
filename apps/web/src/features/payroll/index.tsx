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
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useBankAccounts } from "../../hooks/use-bank-accounts.js";
import { useEmployees } from "../../hooks/use-employees.js";
import { useCashAccounts, useFinancialCategories } from "../../hooks/use-finance-entries.js";
import { useHotels } from "../../hooks/use-hotels.js";
import { useCreatePayslip, useFinalizePayslip, useMarkPaidPayslip, usePayslips } from "../../hooks/use-payslips.js";
import type { PaymentMethod } from "../../services/finance-entries.js";
import type { Payslip } from "../../services/payslips.js";
import { useAuthStore } from "../../stores/auth-store.js";

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD", "CHECK", "OTHER"];
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement",
  MOBILE_MONEY: "Mobile money",
  CARD: "Carte",
  CHECK: "Chèque",
  OTHER: "Autre",
};

// Référence de branchement (Étape 4, module 5/11) : dernier volet RH/Paie (Phase 8). mark-paid
// alimente automatiquement Finance (crée une Expense + CashTransaction/BankTransaction, §22) —
// contrairement aux autres transitions à un clic (Confirmer/Approuver), elle exige catégorie +
// compte + mode de paiement, d'où un dialogue dédié plutôt qu'un simple bouton.
export default function PayrollPage() {
  return (
    <div className="flex flex-col gap-5">
      <PayslipsCard />
    </div>
  );
}

function PayslipsCard() {
  const user = useAuthStore((s) => s.user);
  const payslips = usePayslips();
  const employees = useEmployees();
  const hotels = useHotels();
  const finalize = useFinalizePayslip();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<Payslip | null>(null);

  const employeeNameById = new Map(
    (employees.data ?? []).map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`])
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Bulletins de paie</CardTitle>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={(employees.data ?? []).length === 0}>
              <Icons.IconPlus />
              Nouveau bulletin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreatePayslipForm
              employeeOptions={employees.data ?? []}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={payslips.isLoading}
          error={payslips.error}
          data={payslips.data}
          onRetry={() => payslips.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun bulletin de paie"
          emptyDescription={
            (employees.data ?? []).length === 0
              ? "Ajoutez d'abord un employé (module RH)."
              : "Créez votre premier bulletin de paie."
          }
          emptyAction={
            (employees.data ?? []).length > 0 ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Icons.IconPlus />
                Nouveau bulletin
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<Payslip>[] = [
              {
                id: "employee",
                header: "Employé",
                sortValue: (payslip) => employeeNameById.get(payslip.employeeId) ?? "",
                cell: (payslip) => employeeNameById.get(payslip.employeeId) ?? "—",
              },
              {
                id: "period",
                header: "Période",
                sortValue: (payslip) => payslip.periodYear * 100 + payslip.periodMonth,
                cell: (payslip) => `${MONTH_NAMES[payslip.periodMonth - 1]} ${payslip.periodYear}`,
              },
              {
                id: "netPay",
                header: "Salaire net",
                align: "right",
                sortValue: (payslip) => Number(payslip.netPay),
                cell: (payslip) => fmtGNF(Number(payslip.netPay)),
              },
              {
                id: "status",
                header: "Statut",
                cell: (payslip) => <StatusBadge status={payslip.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (payslip) => {
                  if (payslip.status === "DRAFT") {
                    return (
                      <Button size="sm" disabled={finalize.isPending} onClick={() => finalize.mutate(payslip.id)}>
                        Finaliser
                      </Button>
                    );
                  }
                  if (payslip.status === "FINALIZED") {
                    return (
                      <Button size="sm" onClick={() => setMarkPaidTarget(payslip)}>
                        Marquer payé
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
                getRowId={(payslip) => payslip.id}
                searchableText={(payslip) => employeeNameById.get(payslip.employeeId) ?? ""}
                searchPlaceholder="Rechercher par employé…"
                emptyMessage="Aucun bulletin ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>

      <Dialog open={markPaidTarget !== null} onOpenChange={(open) => !open && setMarkPaidTarget(null)}>
        <DialogContent>
          {markPaidTarget ? (
            <MarkPaidForm
              payslip={markPaidTarget}
              employeeName={employeeNameById.get(markPaidTarget.employeeId) ?? "—"}
              onDone={() => setMarkPaidTarget(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CreatePayslipForm({
  employeeOptions,
  hotelOptions,
  onDone,
}: {
  employeeOptions: { id: string; firstName: string; lastName: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createPayslip = useCreatePayslip();
  const now = new Date();
  const [employeeId, setEmployeeId] = useState("");
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));
  const [periodMonth, setPeriodMonth] = useState(String(now.getMonth() + 1));
  const [bonuses, setBonuses] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!employeeId || !periodYear || !periodMonth) return;
    createPayslip.mutate(
      {
        employeeId,
        periodYear: Number(periodYear),
        periodMonth: Number(periodMonth),
        bonuses: bonuses ? Number(bonuses) : undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouveau bulletin de paie</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payslip-hotel">Hôtel</Label>
          <select
            id="payslip-hotel"
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
        <Label htmlFor="payslip-employee">Employé</Label>
        <select
          id="payslip-employee"
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
          <Label htmlFor="payslip-month">Mois</Label>
          <select
            id="payslip-month"
            required
            value={periodMonth}
            onChange={(event) => setPeriodMonth(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payslip-year">Année</Label>
          <Input
            id="payslip-year"
            type="number"
            min={2000}
            required
            value={periodYear}
            onChange={(e) => setPeriodYear(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payslip-bonuses">Primes (optionnel, GNF)</Label>
        <Input id="payslip-bonuses" type="number" min={0} step="0.01" value={bonuses} onChange={(e) => setBonuses(e.target.value)} />
      </div>

      <p className="text-xs text-muted-foreground">
        Le salaire de base est repris de la fiche employé au moment de la création.
      </p>

      {createPayslip.isError ? (
        <p className="text-sm text-destructive">
          {createPayslip.error instanceof Error ? createPayslip.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createPayslip.isPending}>
          {createPayslip.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function MarkPaidForm({
  payslip,
  employeeName,
  onDone,
}: {
  payslip: Payslip;
  employeeName: string;
  onDone: () => void;
}) {
  const markPaid = useMarkPaidPayslip();
  const categories = useFinancialCategories();
  const cashAccounts = useCashAccounts();
  const bankAccounts = useBankAccounts();
  const [categoryId, setCategoryId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [accountError, setAccountError] = useState<string | null>(null);

  const expenseCategories = (categories.data ?? []).filter((category) => category.type === "EXPENSE");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const hasCash = Boolean(cashAccountId);
    const hasBank = Boolean(bankAccountId);
    if (hasCash === hasBank) {
      setAccountError("Sélectionnez exactement un compte (caisse ou banque).");
      return;
    }
    setAccountError(null);
    if (!categoryId) return;
    markPaid.mutate(
      {
        id: payslip.id,
        input: {
          categoryId,
          paymentMethod,
          cashAccountId: cashAccountId || undefined,
          bankAccountId: bankAccountId || undefined,
        },
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Marquer payé — {employeeName}</DialogTitle>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">
        Montant net : <span className="font-[var(--fw-subtitle-strong)] text-foreground">{fmtGNF(Number(payslip.netPay))}</span>
        . Crée automatiquement une dépense comptabilisée et une transaction de caisse/banque.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mark-paid-category">Catégorie de dépense</Label>
        <select
          id="mark-paid-category"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner une catégorie
          </option>
          {expenseCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mark-paid-method">Mode de paiement</Label>
        <select
          id="mark-paid-method"
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mark-paid-cash">Caisse</Label>
          <select
            id="mark-paid-cash"
            value={cashAccountId}
            onChange={(event) => {
              setCashAccountId(event.target.value);
              if (event.target.value) setBankAccountId("");
            }}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucune</option>
            {(cashAccounts.data ?? [])
              .filter((account) => account.isActive)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mark-paid-bank">Banque</Label>
          <select
            id="mark-paid-bank"
            value={bankAccountId}
            onChange={(event) => {
              setBankAccountId(event.target.value);
              if (event.target.value) setCashAccountId("");
            }}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucune</option>
            {(bankAccounts.data ?? [])
              .filter((account) => account.isActive)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {accountError ? <p className="text-sm text-destructive">{accountError}</p> : null}

      {markPaid.isError ? (
        <p className="text-sm text-destructive">
          {markPaid.error instanceof Error ? markPaid.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={markPaid.isPending}>
          {markPaid.isPending ? "Enregistrement…" : "Marquer payé"}
        </Button>
      </DialogFooter>
    </form>
  );
}
