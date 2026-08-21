import { fmtGNF } from "@nimbalodge/utils";
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
  StatusBadge,
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import {
  useBankAccounts,
  useBankTransactions,
  useCreateBankAccount,
  useCreateBankTransaction,
  useUpdateBankAccount,
} from "../../hooks/use-bank-accounts.js";
import {
  useAddBudgetLine,
  useBudget,
  useBudgetExecution,
  useBudgets,
  useCheckBudgetOverspend,
  useCreateBudget,
} from "../../hooks/use-budgets.js";
import { useDepartments } from "../../hooks/use-departments.js";
import { useHotels } from "../../hooks/use-hotels.js";
import { usePermission } from "../../hooks/use-permission.js";
import {
  useApproveExpense,
  useCashAccounts,
  useCashTransactions,
  useCreateCashAccount,
  useCreateCashTransaction,
  useCreateExpense,
  useCreateRevenue,
  useExpenses,
  useFinancialCategories,
  useMarkExpensePaid,
  useRevenues,
  useSubmitExpense,
  useUpdateCashAccount,
} from "../../hooks/use-finance-entries.js";
import {
  useCancelInvoice,
  useCreateCreditNote,
  useCreateInvoice,
  useCreatePayment,
  useCreditNotes,
  useInvoices,
  useIssueInvoice,
  usePayments,
} from "../../hooks/use-invoices.js";
import type { BankAccount, BankTransaction } from "../../services/bank-accounts.js";
import type { Budget, BudgetPeriod } from "../../services/budgets.js";
import type {
  CashAccount,
  CashTransaction,
  Expense,
  FinancialCategoryType,
  PaymentMethod,
  TransactionDirection,
} from "../../services/finance-entries.js";
import type { ClientType, Invoice } from "../../services/invoices.js";
import { useAuthStore } from "../../stores/auth-store.js";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD", "CHECK", "OTHER"];
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement",
  MOBILE_MONEY: "Mobile money",
  CARD: "Carte",
  CHECK: "Chèque",
  OTHER: "Autre",
};

const EXPENSE_STATUS_LABELS: Record<Expense["status"], string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
  PAID: "Payée",
  BOOKED: "Comptabilisée",
};

const DIRECTION_LABELS: Record<TransactionDirection, string> = { IN: "Entrée", OUT: "Sortie" };

const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  ANNUAL: "Annuel",
  QUARTERLY: "Trimestriel",
  MONTHLY: "Mensuel",
};

const CATEGORY_TYPE_LABELS: Record<FinancialCategoryType, string> = { REVENUE: "Recette", EXPENSE: "Dépense" };

const CLIENT_TYPE_LABELS: Record<ClientType, string> = { INDIVIDUAL: "Particulier", COMPANY: "Entreprise" };

// Ancien point d'entrée unique /finance (Phase 14) — remplacé par une architecture module →
// sous-module (Finance devient un parent avec un écran dédié par sous-ressource, voir
// finance-layout.tsx + router.tsx). Ce fichier reste la source des Cards/formulaires métier
// existants (liste réelle + création réelle, aucune donnée fabriquée) : chaque sous-page de
// features/finance/*-page.tsx importe et réutilise la Card correspondante telle quelle, sans
// réécrire ses champs ni son workflow. Catégories/caisses viennent de ce que l'hôtel a lui-même
// configuré (Paramètres, aucun défaut imposé) ; tant qu'aucune n'existe, les formulaires de
// création affichent leur propre état "aucune catégorie/caisse — configurez-en une d'abord" plutôt
// qu'un select vide silencieux.
export function RevenuesCard() {
  const revenues = useRevenues();
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCreate = usePermission("finance-revenues.create");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recettes</CardTitle>
        {canCreate ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Icons.IconPlus />
                Ajouter une recette
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateRevenueForm onDone={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={revenues.isLoading}
          error={revenues.error}
          data={revenues.data}
          onRetry={() => revenues.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune recette enregistrée"
          emptyDescription="Les recettes apparaîtront ici au fur et à mesure de leur saisie."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Icons.IconPlus />
                Ajouter une recette
              </Button>
            ) : undefined
          }
        >
          {(data) => (
            <ul className="flex flex-col divide-y divide-border">
              {data.map((revenue) => (
                <li key={revenue.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{new Date(revenue.date).toLocaleDateString("fr-FR")}</span>
                  <span className="flex-1 text-right font-[var(--fw-subtitle-strong)]">
                    {fmtGNF(Number(revenue.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateRevenueForm({ onDone }: { onDone: () => void }) {
  const categories = useFinancialCategories();
  const cashAccounts = useCashAccounts();
  const createRevenue = useCreateRevenue();
  const [categoryId, setCategoryId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");

  const revenueCategories = (categories.data ?? []).filter((c) => c.type === "REVENUE" && c.isActive);
  const accounts = (cashAccounts.data ?? []).filter((a) => a.isActive);

  if (categories.isLoading || cashAccounts.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>;
  }

  if (revenueCategories.length === 0 || accounts.length === 0) {
    return (
      <div className="flex flex-col gap-2 py-4">
        <DialogHeader>
          <DialogTitle>Ajouter une recette</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {revenueCategories.length === 0
            ? "Aucune catégorie de recette configurée pour cet hôtel."
            : "Aucune caisse configurée pour cet hôtel."}{" "}
          Configurez-en une depuis Finance → Paramètres avant de saisir une recette.
        </p>
      </div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!categoryId || !cashAccountId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }
    createRevenue.mutate(
      { categoryId, cashAccountId, amount: parsedAmount, paymentMethod },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter une recette</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="revenue-category">Catégorie</Label>
        <select
          id="revenue-category"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner
          </option>
          {revenueCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="revenue-amount">Montant (GNF)</Label>
        <Input
          id="revenue-amount"
          type="number"
          min="1"
          step="1"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="revenue-payment-method">Mode de paiement</Label>
        <select
          id="revenue-payment-method"
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="revenue-cash-account">Caisse</Label>
        <select
          id="revenue-cash-account"
          required
          value={cashAccountId}
          onChange={(event) => setCashAccountId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {createRevenue.isError ? (
        <p className="text-sm text-destructive">
          {createRevenue.error instanceof Error ? createRevenue.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createRevenue.isPending}>
          {createRevenue.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ExpensesCard() {
  const expenses = useExpenses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const submitExpense = useSubmitExpense();
  const approveExpense = useApproveExpense();
  const canCreate = usePermission("finance-expenses.create");
  const canSubmit = usePermission("finance-expenses.submit");
  const canApprove = usePermission("finance-expenses.approve");
  const canPay = usePermission("finance-expenses.pay");
  const markPaid = useMarkExpensePaid();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Dépenses</CardTitle>
        {canCreate ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Icons.IconPlus />
                Ajouter une dépense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateExpenseForm onDone={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={expenses.isLoading}
          error={expenses.error}
          data={expenses.data}
          onRetry={() => expenses.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune dépense enregistrée"
          emptyDescription="Les dépenses apparaîtront ici au fur et à mesure de leur saisie."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Icons.IconPlus />
                Ajouter une dépense
              </Button>
            ) : undefined
          }
        >
          {(data) => (
            <ul className="flex flex-col divide-y divide-border">
              {data.map((expense) => (
                <li key={expense.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">{new Date(expense.date).toLocaleDateString("fr-FR")}</span>
                  <Badge variant="secondary">{EXPENSE_STATUS_LABELS[expense.status]}</Badge>
                  <span className="flex-1 text-right font-[var(--fw-subtitle-strong)]">
                    {fmtGNF(Number(expense.amount))}
                  </span>
                  {expense.status === "DRAFT" && canSubmit ? (
                    <Button size="sm" variant="outline" onClick={() => submitExpense.mutate(expense.id)}>
                      Soumettre
                    </Button>
                  ) : null}
                  {expense.status === "PENDING" && canApprove ? (
                    <Button size="sm" variant="outline" onClick={() => approveExpense.mutate(expense.id)}>
                      Approuver
                    </Button>
                  ) : null}
                  {expense.status === "APPROVED" && canPay ? (
                    <Button size="sm" variant="outline" onClick={() => markPaid.mutate(expense.id)}>
                      Marquer payée
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateExpenseForm({ onDone }: { onDone: () => void }) {
  const categories = useFinancialCategories();
  const cashAccounts = useCashAccounts();
  const createExpense = useCreateExpense();
  const [categoryId, setCategoryId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");

  const expenseCategories = (categories.data ?? []).filter((c) => c.type === "EXPENSE" && c.isActive);
  const accounts = (cashAccounts.data ?? []).filter((a) => a.isActive);

  if (categories.isLoading || cashAccounts.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>;
  }

  if (expenseCategories.length === 0 || accounts.length === 0) {
    return (
      <div className="flex flex-col gap-2 py-4">
        <DialogHeader>
          <DialogTitle>Ajouter une dépense</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {expenseCategories.length === 0
            ? "Aucune catégorie de dépense configurée pour cet hôtel."
            : "Aucune caisse configurée pour cet hôtel."}{" "}
          Configurez-en une depuis Finance → Paramètres avant de saisir une dépense.
        </p>
      </div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!categoryId || !cashAccountId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }
    createExpense.mutate(
      { categoryId, cashAccountId, amount: parsedAmount, paymentMethod, vendorName: vendorName || undefined },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter une dépense</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-category">Catégorie</Label>
        <select
          id="expense-category"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner
          </option>
          {expenseCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-vendor">Fournisseur (texte libre, optionnel)</Label>
        <Input id="expense-vendor" value={vendorName} onChange={(event) => setVendorName(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-amount">Montant (GNF)</Label>
        <Input
          id="expense-amount"
          type="number"
          min="1"
          step="1"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-payment-method">Mode de paiement</Label>
        <select
          id="expense-payment-method"
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-cash-account">Caisse</Label>
        <select
          id="expense-cash-account"
          required
          value={cashAccountId}
          onChange={(event) => setCashAccountId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {createExpense.isError ? (
        <p className="text-sm text-destructive">
          {createExpense.error instanceof Error ? createExpense.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createExpense.isPending}>
          {createExpense.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CashAccountsCard() {
  const user = useAuthStore((s) => s.user);
  const cashAccounts = useCashAccounts();
  const updateCashAccount = useUpdateCashAccount();
  const hotels = useHotels();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [transactionsTarget, setTransactionsTarget] = useState<CashAccount | null>(null);
  const canCreate = usePermission("finance-cash-accounts.create");
  const canUpdate = usePermission("finance-cash-accounts.update");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Caisse</CardTitle>
        {canCreate ? (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Icons.IconPlus />
                Ajouter une caisse
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateCashAccountForm
                hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
                onDone={() => setCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={cashAccounts.isLoading}
          error={cashAccounts.error}
          data={cashAccounts.data}
          onRetry={() => cashAccounts.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune caisse configurée"
          emptyDescription="Créez votre première caisse pour commencer à encaisser des recettes."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Icons.IconPlus />
                Ajouter une caisse
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<CashAccount>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (account) => account.name.toLowerCase(),
                cell: (account) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{account.name}</span>
                    {account.code ? <Badge variant="secondary">{account.code}</Badge> : null}
                    {!account.isActive ? <Badge variant="outline">Désactivée</Badge> : null}
                  </div>
                ),
              },
              {
                id: "balance",
                header: "Solde",
                align: "right",
                sortValue: (account) => Number(account.balance),
                cell: (account) => fmtGNF(Number(account.balance)),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (account) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setTransactionsTarget(account)}>
                      Transactions
                    </Button>
                    {canUpdate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateCashAccount.isPending}
                        onClick={() =>
                          updateCashAccount.mutate({ id: account.id, input: { isActive: !account.isActive } })
                        }
                      >
                        {account.isActive ? "Désactiver" : "Réactiver"}
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
                getRowId={(account) => account.id}
                searchableText={(account) => `${account.name} ${account.code ?? ""}`}
                searchPlaceholder="Rechercher une caisse…"
                emptyMessage="Aucune caisse ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>

      <Dialog open={transactionsTarget !== null} onOpenChange={(open) => !open && setTransactionsTarget(null)}>
        <DialogContent className="max-w-lg">
          {transactionsTarget ? (
            <CashTransactionsView account={transactionsTarget} />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CreateCashAccountForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createCashAccount = useCreateCashAccount();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name) return;
    createCashAccount.mutate(
      {
        name,
        code: code || undefined,
        openingBalance: openingBalance ? Number(openingBalance) : undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter une caisse</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cash-account-hotel">Hôtel</Label>
          <select
            id="cash-account-hotel"
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
        <Label htmlFor="cash-account-name">Nom</Label>
        <Input id="cash-account-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cash-account-code">Code (optionnel)</Label>
          <Input id="cash-account-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cash-account-opening">Solde d'ouverture (optionnel, GNF)</Label>
          <Input
            id="cash-account-opening"
            type="number"
            min={0}
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
        </div>
      </div>

      {createCashAccount.isError ? (
        <p className="text-sm text-destructive">
          {createCashAccount.error instanceof Error ? createCashAccount.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createCashAccount.isPending}>
          {createCashAccount.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CashTransactionsView({ account }: { account: CashAccount }) {
  const transactions = useCashTransactions(account.id);
  const createTransaction = useCreateCashTransaction();
  const canUpdate = usePermission("finance-cash-accounts.update");
  const [direction, setDirection] = useState<TransactionDirection>("IN");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!label || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    createTransaction.mutate(
      { cashAccountId: account.id, input: { direction, amount: parsedAmount, label } },
      { onSuccess: () => { setAmount(""); setLabel(""); } }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Transactions — {account.name}</DialogTitle>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">
        Solde actuel : <span className="font-[var(--fw-subtitle-strong)] text-foreground">{fmtGNF(Number(account.balance))}</span>
      </p>

      {canUpdate ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-tx-direction">Sens</Label>
            <select
              id="cash-tx-direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value as TransactionDirection)}
              className="flex h-9 w-28 rounded-md border border-border bg-background px-3 text-sm"
            >
              {(Object.keys(DIRECTION_LABELS) as TransactionDirection[]).map((value) => (
                <option key={value} value={value}>
                  {DIRECTION_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cash-tx-amount">Montant</Label>
            <Input
              id="cash-tx-amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              className="w-32"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="cash-tx-label">Libellé</Label>
            <Input id="cash-tx-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={createTransaction.isPending}>
            {createTransaction.isPending ? "…" : "Ajouter"}
          </Button>
        </form>
      ) : null}
      {createTransaction.isError ? (
        <p className="text-sm text-destructive">
          {createTransaction.error instanceof Error ? createTransaction.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <QueryState isLoading={transactions.isLoading} error={transactions.error} data={transactions.data}>
        {(data) =>
          data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune transaction enregistrée.</p>
          ) : (
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
              {[...data].reverse().map((transaction: CashTransaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{transaction.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span
                    className={
                      transaction.direction === "IN"
                        ? "font-[var(--fw-subtitle-strong)] text-good"
                        : "font-[var(--fw-subtitle-strong)] text-critical"
                    }
                  >
                    {transaction.direction === "IN" ? "+" : "-"}
                    {fmtGNF(Number(transaction.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </div>
  );
}

export function BankAccountsCard() {
  const user = useAuthStore((s) => s.user);
  const bankAccounts = useBankAccounts();
  const updateBankAccount = useUpdateBankAccount();
  const hotels = useHotels();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [transactionsTarget, setTransactionsTarget] = useState<BankAccount | null>(null);
  const canCreate = usePermission("finance-bank-accounts.create");
  const canUpdate = usePermission("finance-bank-accounts.update");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Banque</CardTitle>
        {canCreate ? (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Icons.IconPlus />
                Ajouter un compte bancaire
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateBankAccountForm
                hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
                onDone={() => setCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={bankAccounts.isLoading}
          error={bankAccounts.error}
          data={bankAccounts.data}
          onRetry={() => bankAccounts.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun compte bancaire configuré"
          emptyDescription="Créez votre premier compte bancaire pour commencer à suivre vos virements."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Icons.IconPlus />
                Ajouter un compte bancaire
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<BankAccount>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (account) => account.name.toLowerCase(),
                cell: (account) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{account.name}</span>
                    {!account.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                  </div>
                ),
              },
              {
                id: "bank",
                header: "Banque",
                cell: (account) =>
                  [account.bankName, account.accountNumber].filter(Boolean).join(" · ") || "—",
              },
              {
                id: "balance",
                header: "Solde",
                align: "right",
                sortValue: (account) => Number(account.balance),
                cell: (account) => fmtGNF(Number(account.balance)),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (account) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setTransactionsTarget(account)}>
                      Transactions
                    </Button>
                    {canUpdate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateBankAccount.isPending}
                        onClick={() =>
                          updateBankAccount.mutate({ id: account.id, input: { isActive: !account.isActive } })
                        }
                      >
                        {account.isActive ? "Désactiver" : "Réactiver"}
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
                getRowId={(account) => account.id}
                searchableText={(account) => `${account.name} ${account.bankName ?? ""}`}
                searchPlaceholder="Rechercher un compte bancaire…"
                emptyMessage="Aucun compte bancaire ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>

      <Dialog open={transactionsTarget !== null} onOpenChange={(open) => !open && setTransactionsTarget(null)}>
        <DialogContent className="max-w-lg">
          {transactionsTarget ? <BankTransactionsView account={transactionsTarget} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CreateBankAccountForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createBankAccount = useCreateBankAccount();
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name) return;
    createBankAccount.mutate(
      {
        name,
        bankName: bankName || undefined,
        accountNumber: accountNumber || undefined,
        openingBalance: openingBalance ? Number(openingBalance) : undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un compte bancaire</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank-account-hotel">Hôtel</Label>
          <select
            id="bank-account-hotel"
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
        <Label htmlFor="bank-account-name">Nom</Label>
        <Input id="bank-account-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank-account-bank-name">Banque (optionnel)</Label>
          <Input id="bank-account-bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank-account-number">N° de compte (optionnel)</Label>
          <Input id="bank-account-number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bank-account-opening">Solde d'ouverture (optionnel, GNF)</Label>
        <Input
          id="bank-account-opening"
          type="number"
          min={0}
          step="0.01"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
        />
      </div>

      {createBankAccount.isError ? (
        <p className="text-sm text-destructive">
          {createBankAccount.error instanceof Error ? createBankAccount.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createBankAccount.isPending}>
          {createBankAccount.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function BankTransactionsView({ account }: { account: BankAccount }) {
  const transactions = useBankTransactions(account.id);
  const createTransaction = useCreateBankTransaction();
  const canUpdate = usePermission("finance-bank-accounts.update");
  const [direction, setDirection] = useState<TransactionDirection>("IN");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!label || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    createTransaction.mutate(
      { bankAccountId: account.id, input: { direction, amount: parsedAmount, label } },
      { onSuccess: () => { setAmount(""); setLabel(""); } }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Transactions — {account.name}</DialogTitle>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">
        Solde actuel : <span className="font-[var(--fw-subtitle-strong)] text-foreground">{fmtGNF(Number(account.balance))}</span>
      </p>

      {canUpdate ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-tx-direction">Sens</Label>
            <select
              id="bank-tx-direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value as TransactionDirection)}
              className="flex h-9 w-28 rounded-md border border-border bg-background px-3 text-sm"
            >
              {(Object.keys(DIRECTION_LABELS) as TransactionDirection[]).map((value) => (
                <option key={value} value={value}>
                  {DIRECTION_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-tx-amount">Montant</Label>
            <Input
              id="bank-tx-amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              className="w-32"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="bank-tx-label">Libellé</Label>
            <Input id="bank-tx-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={createTransaction.isPending}>
            {createTransaction.isPending ? "…" : "Ajouter"}
          </Button>
        </form>
      ) : null}
      {createTransaction.isError ? (
        <p className="text-sm text-destructive">
          {createTransaction.error instanceof Error ? createTransaction.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <QueryState isLoading={transactions.isLoading} error={transactions.error} data={transactions.data}>
        {(data) =>
          data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune transaction enregistrée.</p>
          ) : (
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
              {[...data].reverse().map((transaction: BankTransaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{transaction.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span
                    className={
                      transaction.direction === "IN"
                        ? "font-[var(--fw-subtitle-strong)] text-good"
                        : "font-[var(--fw-subtitle-strong)] text-critical"
                    }
                  >
                    {transaction.direction === "IN" ? "+" : "-"}
                    {fmtGNF(Number(transaction.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </div>
  );
}

export function BudgetsCard() {
  const user = useAuthStore((s) => s.user);
  const budgets = useBudgets();
  const hotels = useHotels();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [executionTarget, setExecutionTarget] = useState<Budget | null>(null);
  const canCreate = usePermission("finance-budgets.create");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Budgets</CardTitle>
        {canCreate ? (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Icons.IconPlus />
                Créer un budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateBudgetForm
                hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
                onDone={() => setCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={budgets.isLoading}
          error={budgets.error}
          data={budgets.data}
          onRetry={() => budgets.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun budget créé"
          emptyDescription="Créez votre premier budget pour commencer à suivre vos écarts prévu/réalisé."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Icons.IconPlus />
                Créer un budget
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<Budget>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (budget) => budget.name.toLowerCase(),
                cell: (budget) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{budget.name}</span>
                    {!budget.isActive ? <Badge variant="outline">Inactif</Badge> : null}
                  </div>
                ),
              },
              {
                id: "period",
                header: "Période",
                cell: (budget) => (
                  <span className="text-sm">
                    {BUDGET_PERIOD_LABELS[budget.periodType]} · {new Date(budget.startDate).toLocaleDateString("fr-FR")} →{" "}
                    {new Date(budget.endDate).toLocaleDateString("fr-FR")}
                  </span>
                ),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (budget) => (
                  <Button variant="outline" size="sm" onClick={() => setExecutionTarget(budget)}>
                    Voir l'exécution
                  </Button>
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(budget) => budget.id}
                searchableText={(budget) => budget.name}
                searchPlaceholder="Rechercher un budget…"
                emptyMessage="Aucun budget ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>

      <Dialog open={executionTarget !== null} onOpenChange={(open) => !open && setExecutionTarget(null)}>
        <DialogContent className="max-w-2xl">
          {executionTarget ? <BudgetExecutionView budget={executionTarget} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CreateBudgetForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createBudget = useCreateBudget();
  const [name, setName] = useState("");
  const [periodType, setPeriodType] = useState<BudgetPeriod>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name || !startDate || !endDate) return;
    createBudget.mutate(
      { name, periodType, startDate, endDate, hotelId: hotelId || undefined },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Créer un budget</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-hotel">Hôtel</Label>
          <select
            id="budget-hotel"
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
        <Label htmlFor="budget-name">Nom</Label>
        <Input id="budget-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="budget-period">Périodicité</Label>
        <select
          id="budget-period"
          value={periodType}
          onChange={(event) => setPeriodType(event.target.value as BudgetPeriod)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          {(Object.keys(BUDGET_PERIOD_LABELS) as BudgetPeriod[]).map((value) => (
            <option key={value} value={value}>
              {BUDGET_PERIOD_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-start">Début</Label>
          <Input id="budget-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-end">Fin</Label>
          <Input id="budget-end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {createBudget.isError ? (
        <p className="text-sm text-destructive">
          {createBudget.error instanceof Error ? createBudget.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createBudget.isPending}>
          {createBudget.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function BudgetExecutionView({ budget }: { budget: Budget }) {
  const detail = useBudget(budget.id);
  const execution = useBudgetExecution(budget.id);
  const addLine = useAddBudgetLine();
  const checkOverspend = useCheckBudgetOverspend();
  const departments = useDepartments();
  const categories = useFinancialCategories();
  const canUpdate = usePermission("finance-budgets.update");
  const canCheckOverspend = usePermission("finance-budgets.check-overspend");

  const [lineType, setLineType] = useState<FinancialCategoryType>("EXPENSE");
  const [plannedAmount, setPlannedAmount] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const departmentNameById = new Map((departments.data ?? []).map((department) => [department.id, department.name]));
  const categoryNameById = new Map((categories.data ?? []).map((category) => [category.id, category.name]));
  const matchingCategories = (categories.data ?? []).filter((category) => category.type === lineType);

  function handleAddLine(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(plannedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    addLine.mutate(
      {
        budgetId: budget.id,
        input: {
          type: lineType,
          plannedAmount: parsedAmount,
          departmentId: departmentId || undefined,
          categoryId: categoryId || undefined,
        },
      },
      { onSuccess: () => { setPlannedAmount(""); setDepartmentId(""); setCategoryId(""); } }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>
          {budget.name} — {BUDGET_PERIOD_LABELS[budget.periodType]}
        </DialogTitle>
      </DialogHeader>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {new Date(budget.startDate).toLocaleDateString("fr-FR")} → {new Date(budget.endDate).toLocaleDateString("fr-FR")}
        </p>
        {canCheckOverspend ? (
          <Button
            variant="outline"
            size="sm"
            disabled={checkOverspend.isPending}
            onClick={() => checkOverspend.mutate(budget.id)}
          >
            Vérifier les dépassements
          </Button>
        ) : null}
      </div>
      {checkOverspend.data ? (
        <p className="text-sm text-muted-foreground">
          {checkOverspend.data.overspentLineCount === 0
            ? "Aucune ligne en dépassement."
            : `${checkOverspend.data.overspentLineCount} ligne(s) en dépassement — ${checkOverspend.data.notificationsCreated} notification(s) créée(s).`}
        </p>
      ) : null}

      {canUpdate ? (
        <form onSubmit={handleAddLine} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget-line-type">Type</Label>
            <select
              id="budget-line-type"
              value={lineType}
              onChange={(event) => {
                setLineType(event.target.value as FinancialCategoryType);
                setCategoryId("");
              }}
              className="flex h-9 w-28 rounded-md border border-border bg-background px-3 text-sm"
            >
              {(Object.keys(CATEGORY_TYPE_LABELS) as FinancialCategoryType[]).map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget-line-department">Département (optionnel)</Label>
            <select
              id="budget-line-department"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="flex h-9 w-36 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Tous</option>
              {(departments.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget-line-category">Catégorie (optionnel)</Label>
            <select
              id="budget-line-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="flex h-9 w-36 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Toutes</option>
              {matchingCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget-line-amount">Prévu (GNF)</Label>
            <Input
              id="budget-line-amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              className="w-32"
              value={plannedAmount}
              onChange={(e) => setPlannedAmount(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={addLine.isPending}>
            {addLine.isPending ? "…" : "Ajouter une ligne"}
          </Button>
        </form>
      ) : null}
      {addLine.isError ? (
        <p className="text-sm text-destructive">
          {addLine.error instanceof Error ? addLine.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <QueryState
        isLoading={execution.isLoading || detail.isLoading}
        error={execution.error ?? detail.error}
        data={execution.data}
        isEmpty={(data) => data.lines.length === 0}
        emptyTitle="Aucune ligne de budget"
        emptyDescription="Ajoutez une première ligne ci-dessus pour commencer le suivi."
      >
        {(data) => (
          <ul className="flex flex-col divide-y divide-border">
            {data.lines.map((line) => {
              const detailLine = detail.data?.lines.find((l) => l.id === line.lineId);
              const label = [
                detailLine?.departmentId ? departmentNameById.get(detailLine.departmentId) : null,
                detailLine?.categoryId ? categoryNameById.get(detailLine.categoryId) : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Toutes dimensions";
              const overspent = line.type === "EXPENSE" && Number(line.actual) > Number(line.planned);
              return (
                <li key={line.lineId} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-[var(--fw-subtitle-strong)]">{label}</span>
                    <Badge variant="secondary">{CATEGORY_TYPE_LABELS[line.type]}</Badge>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>Prévu : {fmtGNF(Number(line.planned))}</span>
                    <span className={overspent ? "font-[var(--fw-subtitle-strong)] text-critical" : ""}>
                      Réalisé : {fmtGNF(Number(line.actual))}
                    </span>
                    <span>Écart : {fmtGNF(Number(line.variance))}</span>
                    <span>Taux : {Number(line.executionRate).toFixed(0)}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

interface InvoiceLineDraft {
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
}

export function InvoicesCard() {
  const user = useAuthStore((s) => s.user);
  const invoices = useInvoices();
  const hotels = useHotels();
  const issueInvoice = useIssueInvoice();
  const cancelInvoice = useCancelInvoice();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailTargetId, setDetailTargetId] = useState<string | null>(null);
  const anyPending = issueInvoice.isPending || cancelInvoice.isPending;
  const detailTarget = invoices.data?.find((invoice) => invoice.id === detailTargetId) ?? null;
  const canCreate = usePermission("finance-invoices.create");
  const canIssue = usePermission("finance-invoices.issue");
  const canCancel = usePermission("finance-invoices.cancel");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Facturation</CardTitle>
        {canCreate ? (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Icons.IconPlus />
                Nouvelle facture
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <CreateInvoiceForm
                hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
                onDone={() => setCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={invoices.isLoading}
          error={invoices.error}
          data={invoices.data}
          onRetry={() => invoices.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune facture créée"
          emptyDescription="Créez votre première facture client."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Icons.IconPlus />
                Nouvelle facture
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<Invoice>[] = [
              {
                id: "number",
                header: "N°",
                cell: (invoice) => invoice.invoiceNumber ?? "Brouillon",
              },
              {
                id: "client",
                header: "Client",
                sortValue: (invoice) => invoice.clientName.toLowerCase(),
                cell: (invoice) => invoice.clientName,
              },
              {
                id: "total",
                header: "Montant total",
                align: "right",
                sortValue: (invoice) => Number(invoice.grandTotal),
                cell: (invoice) => fmtGNF(Number(invoice.grandTotal)),
              },
              {
                id: "due",
                header: "Solde dû",
                align: "right",
                sortValue: (invoice) => Number(invoice.dueBalance),
                cell: (invoice) => fmtGNF(Number(invoice.dueBalance)),
              },
              {
                id: "status",
                header: "Statut",
                cell: (invoice) => <StatusBadge status={invoice.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (invoice) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailTargetId(invoice.id)}>
                      Détails
                    </Button>
                    {invoice.status === "DRAFT" && canIssue ? (
                      <Button size="sm" disabled={anyPending} onClick={() => issueInvoice.mutate(invoice.id)}>
                        Émettre
                      </Button>
                    ) : null}
                    {(invoice.status === "DRAFT" || invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") &&
                    canCancel ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={anyPending}
                        onClick={() => cancelInvoice.mutate(invoice.id)}
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
                getRowId={(invoice) => invoice.id}
                searchableText={(invoice) => `${invoice.invoiceNumber ?? ""} ${invoice.clientName}`}
                searchPlaceholder="Rechercher par numéro ou client…"
                emptyMessage="Aucune facture ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>

      <Dialog open={detailTargetId !== null} onOpenChange={(open) => !open && setDetailTargetId(null)}>
        <DialogContent className="max-w-2xl">
          {detailTarget ? <InvoiceDetailView invoice={detailTarget} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CreateInvoiceForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createInvoice = useCreateInvoice();
  const categories = useFinancialCategories();
  const revenueCategories = (categories.data ?? []).filter((c) => c.type === "REVENUE" && c.isActive);

  const [categoryId, setCategoryId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState<ClientType>("INDIVIDUAL");
  const [dueDate, setDueDate] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([
    { description: "", quantity: "1", unitPrice: "", discountRate: "", taxRate: "" },
  ]);

  function updateLine(index: number, patch: Partial<InvoiceLineDraft>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }
  function addLine() {
    setLines((current) => [...current, { description: "", quantity: "1", unitPrice: "", discountRate: "", taxRate: "" }]);
  }
  function removeLine(index: number) {
    setLines((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  const total = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity) || 0;
    const unitPrice = Number(line.unitPrice) || 0;
    const discountRate = Number(line.discountRate) || 0;
    const taxRate = Number(line.taxRate) || 0;
    const base = quantity * unitPrice;
    return sum + (base - base * discountRate) * (1 + taxRate);
  }, 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!categoryId || !clientName) return;
    const validLines = lines
      .filter((line) => line.description && line.quantity && line.unitPrice)
      .map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountRate: line.discountRate ? Number(line.discountRate) : undefined,
        taxRate: line.taxRate ? Number(line.taxRate) : undefined,
      }));
    if (validLines.length === 0) return;
    createInvoice.mutate(
      {
        categoryId,
        clientName,
        clientType,
        dueDate: dueDate || undefined,
        lines: validLines,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  if (categories.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>;
  }

  if (revenueCategories.length === 0) {
    return (
      <div className="flex flex-col gap-2 py-4">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Aucune catégorie de recette configurée pour cet hôtel. Configurez-en une avant de créer une facture.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouvelle facture</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-hotel">Hôtel</Label>
          <select
            id="invoice-hotel"
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
          <Label htmlFor="invoice-category">Catégorie</Label>
          <select
            id="invoice-category"
            required
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Sélectionner
            </option>
            {revenueCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-client-type">Type de client</Label>
          <select
            id="invoice-client-type"
            value={clientType}
            onChange={(event) => setClientType(event.target.value as ClientType)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map((value) => (
              <option key={value} value={value}>
                {CLIENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-client-name">Client</Label>
          <Input id="invoice-client-name" required value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoice-due-date">Échéance (optionnel)</Label>
          <Input id="invoice-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Lignes</Label>
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[1fr_4rem_6rem_4rem_4rem_auto] items-center gap-2">
            <Input
              placeholder="Description"
              required
              value={line.description}
              onChange={(event) => updateLine(index, { description: event.target.value })}
            />
            <Input
              type="number"
              min={0.01}
              step="0.01"
              placeholder="Qté"
              required
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: event.target.value })}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Prix unit."
              required
              value={line.unitPrice}
              onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
            />
            <Input
              type="number"
              min={0}
              max={1}
              step="0.01"
              placeholder="Remise"
              value={line.discountRate}
              onChange={(event) => updateLine(index, { discountRate: event.target.value })}
            />
            <Input
              type="number"
              min={0}
              max={1}
              step="0.01"
              placeholder="Taxe"
              value={line.taxRate}
              onChange={(event) => updateLine(index, { taxRate: event.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={lines.length === 1}
              onClick={() => removeLine(index)}
              aria-label="Retirer la ligne"
            >
              <Icons.IconClose />
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Remise/Taxe en fraction (0.18 = 18%), optionnelles.</p>
        <Button type="button" variant="outline" size="sm" onClick={addLine} className="self-start">
          <Icons.IconPlus />
          Ajouter une ligne
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Total : <span className="font-[var(--fw-subtitle-strong)] text-foreground">{fmtGNF(total)}</span>
      </p>

      {createInvoice.isError ? (
        <p className="text-sm text-destructive">
          {createInvoice.error instanceof Error ? createInvoice.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createInvoice.isPending}>
          {createInvoice.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function InvoiceDetailView({ invoice }: { invoice: Invoice }) {
  const payments = usePayments(invoice.id);
  const creditNotes = useCreditNotes(invoice.id);
  const cashAccounts = useCashAccounts();
  const bankAccounts = useBankAccounts();
  const createPayment = useCreatePayment();
  const createCreditNote = useCreateCreditNote();

  const canCreatePayment = usePermission("finance-payments.create");
  const canCreateCreditNote = usePermission("finance-credit-notes.create");
  const canPay = (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") && canCreatePayment;
  const canCredit = invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && canCreateCreditNote;

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentAccount, setPaymentAccount] = useState("");

  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditAccount, setCreditAccount] = useState("");

  const accountOptions = [
    ...(cashAccounts.data ?? []).filter((a) => a.isActive).map((a) => ({ id: `cash:${a.id}`, label: `Caisse — ${a.name}` })),
    ...(bankAccounts.data ?? []).filter((a) => a.isActive).map((a) => ({ id: `bank:${a.id}`, label: `Banque — ${a.name}` })),
  ];

  function handleAddPayment(event: FormEvent) {
    event.preventDefault();
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !paymentAccount) return;
    const [kind, id] = paymentAccount.split(":");
    createPayment.mutate(
      {
        invoiceId: invoice.id,
        input: {
          amount,
          paymentMethod,
          cashAccountId: kind === "cash" ? id : undefined,
          bankAccountId: kind === "bank" ? id : undefined,
        },
      },
      { onSuccess: () => { setPaymentAmount(""); setPaymentAccount(""); } }
    );
  }

  function handleAddCreditNote(event: FormEvent) {
    event.preventDefault();
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const [kind, id] = creditAccount ? creditAccount.split(":") : [undefined, undefined];
    createCreditNote.mutate(
      {
        invoiceId: invoice.id,
        input: {
          amount,
          reason: creditReason || undefined,
          cashAccountId: kind === "cash" ? id : undefined,
          bankAccountId: kind === "bank" ? id : undefined,
        },
      },
      { onSuccess: () => { setCreditAmount(""); setCreditReason(""); setCreditAccount(""); } }
    );
  }

  return (
    <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {invoice.invoiceNumber ?? "Brouillon"} — {invoice.clientName}
        </DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Sous-total</p>
          <p className="font-[var(--fw-subtitle-strong)]">{fmtGNF(Number(invoice.subtotal))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-[var(--fw-subtitle-strong)]">{fmtGNF(Number(invoice.grandTotal))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payé</p>
          <p className="font-[var(--fw-subtitle-strong)] text-good">{fmtGNF(Number(invoice.amountPaid))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Solde dû</p>
          <p className="font-[var(--fw-subtitle-strong)]">{fmtGNF(Number(invoice.dueBalance))}</p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {invoice.lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{line.description}</span>
            <span className="text-muted-foreground">
              {line.quantity} × {fmtGNF(Number(line.unitPrice))}
            </span>
            <span className="font-[var(--fw-subtitle-strong)]">{fmtGNF(Number(line.lineTotal))}</span>
          </li>
        ))}
      </ul>

      {canPay ? (
        <form onSubmit={handleAddPayment} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-amount">Montant</Label>
            <Input
              id="payment-amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              className="w-32"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-method">Mode</Label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              className="flex h-9 w-32 rounded-md border border-border bg-background px-3 text-sm"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-account">Compte</Label>
            <select
              id="payment-account"
              required
              value={paymentAccount}
              onChange={(event) => setPaymentAccount(event.target.value)}
              className="flex h-9 w-40 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Sélectionner
              </option>
              {accountOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={createPayment.isPending}>
            {createPayment.isPending ? "…" : "Encaisser"}
          </Button>
        </form>
      ) : null}
      {createPayment.isError ? (
        <p className="text-sm text-destructive">
          {createPayment.error instanceof Error ? createPayment.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <QueryState isLoading={payments.isLoading} error={payments.error} data={payments.data}>
        {(data) =>
          data.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {data.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">{new Date(payment.date).toLocaleDateString("fr-FR")}</span>
                  <span className="font-[var(--fw-subtitle-strong)] text-good">+{fmtGNF(Number(payment.amount))}</span>
                </li>
              ))}
            </ul>
          ) : null
        }
      </QueryState>

      {canCredit ? (
        <form onSubmit={handleAddCreditNote} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-amount">Avoir — Montant</Label>
            <Input
              id="credit-amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              className="w-32"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-reason">Motif (optionnel)</Label>
            <Input
              id="credit-reason"
              className="w-40"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="credit-account">Remboursement (optionnel)</Label>
            <select
              id="credit-account"
              value={creditAccount}
              onChange={(event) => setCreditAccount(event.target.value)}
              className="flex h-9 w-44 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Aucun (avoir sur papier)</option>
              {accountOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={createCreditNote.isPending}>
            {createCreditNote.isPending ? "…" : "Émettre un avoir"}
          </Button>
        </form>
      ) : null}
      {createCreditNote.isError ? (
        <p className="text-sm text-destructive">
          {createCreditNote.error instanceof Error ? createCreditNote.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <QueryState isLoading={creditNotes.isLoading} error={creditNotes.error} data={creditNotes.data}>
        {(data) =>
          data.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {data.map((note) => (
                <li key={note.id} className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">
                    {new Date(note.date).toLocaleDateString("fr-FR")} {note.reason ? `— ${note.reason}` : ""}
                  </span>
                  <span className="font-[var(--fw-subtitle-strong)] text-critical">-{fmtGNF(Number(note.amount))}</span>
                </li>
              ))}
            </ul>
          ) : null
        }
      </QueryState>
    </div>
  );
}
