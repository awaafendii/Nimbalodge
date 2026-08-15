import { fmtGNF } from "@nimbalodge/utils";
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
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import {
  useApproveExpense,
  useCashAccounts,
  useCreateExpense,
  useCreateRevenue,
  useExpenses,
  useFinancialCategories,
  useMarkExpensePaid,
  useRevenues,
  useSubmitExpense,
} from "../../hooks/use-finance-entries.js";
import type { Expense, PaymentMethod } from "../../services/finance-entries.js";

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

// Module de référence pour le branchement frontend↔backend (Phase 14) : listes réelles (GET
// /revenues, GET /expenses), création réelle, workflow d'approbation de dépense réel — aucune
// donnée fabriquée. Catégories/caisses viennent de ce que l'hôtel a lui-même configuré (Paramètres,
// aucun défaut imposé) ; tant qu'aucune n'existe, les formulaires de création affichent leur propre
// état "aucune catégorie/caisse — configurez-en une d'abord" plutôt qu'un select vide silencieux.
export default function FinancePage() {
  return (
    <div className="flex flex-col gap-5">
      <RevenuesCard />
      <ExpensesCard />
    </div>
  );
}

function RevenuesCard() {
  const revenues = useRevenues();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recettes</CardTitle>
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
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Ajouter une recette
            </Button>
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

function ExpensesCard() {
  const expenses = useExpenses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const submitExpense = useSubmitExpense();
  const approveExpense = useApproveExpense();
  const markPaid = useMarkExpensePaid();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Dépenses</CardTitle>
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
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Ajouter une dépense
            </Button>
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
                  {expense.status === "DRAFT" ? (
                    <Button size="sm" variant="outline" onClick={() => submitExpense.mutate(expense.id)}>
                      Soumettre
                    </Button>
                  ) : null}
                  {expense.status === "PENDING" ? (
                    <Button size="sm" variant="outline" onClick={() => approveExpense.mutate(expense.id)}>
                      Approuver
                    </Button>
                  ) : null}
                  {expense.status === "APPROVED" ? (
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
