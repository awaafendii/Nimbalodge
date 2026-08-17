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
import { useDepartments } from "../../hooks/use-departments.js";
import { useHotels } from "../../hooks/use-hotels.js";
import {
  useApprovePurchaseRequest,
  useCancelPurchaseRequest,
  useCreatePurchaseRequest,
  usePurchaseRequests,
  useRejectPurchaseRequest,
} from "../../hooks/use-purchase-requests.js";
import {
  useCancelPurchaseOrder,
  useCreateGoodsReceipt,
  useCreatePurchaseOrder,
  usePurchaseOrders,
  useSendPurchaseOrder,
} from "../../hooks/use-purchase-orders.js";
import { useCreateSupplier, useSuppliers, useUpdateSupplier } from "../../hooks/use-suppliers.js";
import type { PurchaseOrder } from "../../services/purchase-orders.js";
import type { PurchaseRequest } from "../../services/purchase-requests.js";
import type { Supplier } from "../../services/suppliers.js";
import { useAuthStore } from "../../stores/auth-store.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Référence de branchement (Étape 4, module 6/11) : "Demandes, commandes, fournisseurs" (subtitle
// nav-config.tsx) — Fournisseurs avant Demandes/Commandes (une commande référence un fournisseur
// déjà créé, une commande peut référencer une demande déjà approuvée).
export default function PurchasesPage() {
  return (
    <div className="flex flex-col gap-5">
      <SuppliersCard />
      <PurchaseRequestsCard />
      <PurchaseOrdersCard />
    </div>
  );
}

function SuppliersCard() {
  const user = useAuthStore((s) => s.user);
  const suppliers = useSuppliers();
  const updateSupplier = useUpdateSupplier();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Fournisseurs</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Ajouter un fournisseur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreateSupplierForm
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={suppliers.isLoading}
          error={suppliers.error}
          data={suppliers.data}
          onRetry={() => suppliers.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun fournisseur enregistré"
          emptyDescription="Ajoutez votre premier fournisseur pour commencer à passer des commandes."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Ajouter un fournisseur
            </Button>
          }
        >
          {(data) => {
            const columns: DataTableColumn<Supplier>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (supplier) => supplier.name.toLowerCase(),
                cell: (supplier) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{supplier.name}</span>
                    {!supplier.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                  </div>
                ),
              },
              {
                id: "contact",
                header: "Contact",
                cell: (supplier) => (
                  <div className="text-sm">
                    {supplier.contactName ? <p>{supplier.contactName}</p> : null}
                    {supplier.phone ? <p className="text-muted-foreground">{supplier.phone}</p> : null}
                    {!supplier.contactName && !supplier.phone ? <span className="text-muted-foreground">—</span> : null}
                  </div>
                ),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (supplier) => (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateSupplier.isPending}
                    onClick={() =>
                      updateSupplier.mutate({ id: supplier.id, input: { isActive: !supplier.isActive } })
                    }
                  >
                    {supplier.isActive ? "Désactiver" : "Réactiver"}
                  </Button>
                ),
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(supplier) => supplier.id}
                searchableText={(supplier) => `${supplier.name} ${supplier.contactName ?? ""}`}
                searchPlaceholder="Rechercher un fournisseur…"
                emptyMessage="Aucun fournisseur ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateSupplierForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createSupplier = useCreateSupplier();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name) return;
    createSupplier.mutate(
      {
        name,
        contactName: contactName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un fournisseur</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier-hotel">Hôtel</Label>
          <select
            id="supplier-hotel"
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
        <Label htmlFor="supplier-name">Nom</Label>
        <Input id="supplier-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier-contact">Contact (optionnel)</Label>
          <Input id="supplier-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplier-phone">Téléphone (optionnel)</Label>
          <Input id="supplier-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier-email">Email (optionnel)</Label>
        <Input id="supplier-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {createSupplier.isError ? (
        <p className="text-sm text-destructive">
          {createSupplier.error instanceof Error ? createSupplier.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createSupplier.isPending}>
          {createSupplier.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PurchaseRequestsCard() {
  const user = useAuthStore((s) => s.user);
  const purchaseRequests = usePurchaseRequests();
  const departments = useDepartments();
  const hotels = useHotels();
  const approve = useApprovePurchaseRequest();
  const reject = useRejectPurchaseRequest();
  const cancel = useCancelPurchaseRequest();
  const [dialogOpen, setDialogOpen] = useState(false);

  const departmentNameById = new Map((departments.data ?? []).map((department) => [department.id, department.name]));
  const anyPending = approve.isPending || reject.isPending || cancel.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Demandes d'achat</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Icons.IconPlus />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CreatePurchaseRequestForm
              departmentOptions={departments.data ?? []}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={purchaseRequests.isLoading}
          error={purchaseRequests.error}
          data={purchaseRequests.data}
          onRetry={() => purchaseRequests.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune demande d'achat"
          emptyDescription="Créez votre première demande d'achat."
          emptyAction={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Icons.IconPlus />
              Nouvelle demande
            </Button>
          }
        >
          {(data) => {
            const columns: DataTableColumn<PurchaseRequest>[] = [
              {
                id: "description",
                header: "Description",
                sortValue: (request) => request.description.toLowerCase(),
                cell: (request) => (
                  <div>
                    <p className="text-sm">{request.description}</p>
                    {request.departmentId ? (
                      <p className="text-xs text-muted-foreground">{departmentNameById.get(request.departmentId) ?? "—"}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "amount",
                header: "Montant estimé",
                align: "right",
                sortValue: (request) => Number(request.estimatedAmount ?? 0),
                cell: (request) => (request.estimatedAmount ? fmtGNF(Number(request.estimatedAmount)) : "—"),
              },
              {
                id: "status",
                header: "Statut",
                cell: (request) => <StatusBadge status={request.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (request) =>
                  request.status === "PENDING" ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" disabled={anyPending} onClick={() => approve.mutate(request.id)}>
                        Approuver
                      </Button>
                      <Button variant="outline" size="sm" disabled={anyPending} onClick={() => reject.mutate(request.id)}>
                        Rejeter
                      </Button>
                      <Button variant="outline" size="sm" disabled={anyPending} onClick={() => cancel.mutate(request.id)}>
                        Annuler
                      </Button>
                    </div>
                  ) : null,
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(request) => request.id}
                searchableText={(request) => request.description}
                searchPlaceholder="Rechercher une demande…"
                emptyMessage="Aucune demande ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreatePurchaseRequestForm({
  departmentOptions,
  hotelOptions,
  onDone,
}: {
  departmentOptions: { id: string; name: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createPurchaseRequest = useCreatePurchaseRequest();
  const [description, setDescription] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!description) return;
    createPurchaseRequest.mutate(
      {
        description,
        estimatedAmount: estimatedAmount ? Number(estimatedAmount) : undefined,
        departmentId: departmentId || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouvelle demande d'achat</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pr-hotel">Hôtel</Label>
          <select
            id="pr-hotel"
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
        <Label htmlFor="pr-description">Description</Label>
        <Textarea id="pr-description" required value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pr-amount">Montant estimé (optionnel, GNF)</Label>
          <Input
            id="pr-amount"
            type="number"
            min={0}
            step="0.01"
            value={estimatedAmount}
            onChange={(e) => setEstimatedAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pr-department">Département (optionnel)</Label>
          <select
            id="pr-department"
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

      {createPurchaseRequest.isError ? (
        <p className="text-sm text-destructive">
          {createPurchaseRequest.error instanceof Error ? createPurchaseRequest.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createPurchaseRequest.isPending}>
          {createPurchaseRequest.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PurchaseOrdersCard() {
  const user = useAuthStore((s) => s.user);
  const purchaseOrders = usePurchaseOrders();
  const suppliers = useSuppliers();
  const purchaseRequests = usePurchaseRequests();
  const hotels = useHotels();
  const send = useSendPurchaseOrder();
  const cancel = useCancelPurchaseOrder();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<PurchaseOrder | null>(null);

  const supplierNameById = new Map((suppliers.data ?? []).map((supplier) => [supplier.id, supplier.name]));
  const approvedRequests = (purchaseRequests.data ?? []).filter((request) => request.status === "APPROVED");
  const anyPending = send.isPending || cancel.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Commandes fournisseurs</CardTitle>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={(suppliers.data ?? []).length === 0}>
              <Icons.IconPlus />
              Nouvelle commande
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <CreatePurchaseOrderForm
              supplierOptions={suppliers.data ?? []}
              purchaseRequestOptions={approvedRequests}
              hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
              onDone={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={purchaseOrders.isLoading}
          error={purchaseOrders.error}
          data={purchaseOrders.data}
          onRetry={() => purchaseOrders.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucune commande fournisseur"
          emptyDescription={
            (suppliers.data ?? []).length === 0
              ? "Ajoutez d'abord un fournisseur ci-dessus."
              : "Créez votre première commande fournisseur."
          }
          emptyAction={
            (suppliers.data ?? []).length > 0 ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Icons.IconPlus />
                Nouvelle commande
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<PurchaseOrder>[] = [
              {
                id: "number",
                header: "N°",
                cell: (order) => order.orderNumber ?? "Brouillon",
              },
              {
                id: "supplier",
                header: "Fournisseur",
                sortValue: (order) => supplierNameById.get(order.supplierId) ?? "",
                cell: (order) => supplierNameById.get(order.supplierId) ?? "—",
              },
              {
                id: "lines",
                header: "Lignes",
                cell: (order) => `${order.lines.length} ligne${order.lines.length > 1 ? "s" : ""}`,
              },
              {
                id: "total",
                header: "Montant total",
                align: "right",
                sortValue: (order) => Number(order.orderTotal),
                cell: (order) => fmtGNF(Number(order.orderTotal)),
              },
              {
                id: "status",
                header: "Statut",
                cell: (order) => <StatusBadge status={order.status} />,
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (order) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    {order.status === "DRAFT" ? (
                      <Button size="sm" disabled={anyPending} onClick={() => send.mutate(order.id)}>
                        Envoyer
                      </Button>
                    ) : null}
                    {(order.status === "SENT" || order.status === "PARTIALLY_RECEIVED") ? (
                      <Button size="sm" onClick={() => setReceiptTarget(order)}>
                        Réceptionner
                      </Button>
                    ) : null}
                    {(order.status === "DRAFT" || order.status === "SENT" || order.status === "PARTIALLY_RECEIVED") ? (
                      <Button variant="outline" size="sm" disabled={anyPending} onClick={() => cancel.mutate(order.id)}>
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
                getRowId={(order) => order.id}
                searchableText={(order) => `${order.orderNumber ?? ""} ${supplierNameById.get(order.supplierId) ?? ""}`}
                searchPlaceholder="Rechercher par numéro ou fournisseur…"
                emptyMessage="Aucune commande ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>

      <Dialog open={receiptTarget !== null} onOpenChange={(open) => !open && setReceiptTarget(null)}>
        <DialogContent>
          {receiptTarget ? (
            <ReceiveGoodsForm
              order={receiptTarget}
              supplierName={supplierNameById.get(receiptTarget.supplierId) ?? "—"}
              onDone={() => setReceiptTarget(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface LineDraft {
  description: string;
  quantity: string;
  unitPrice: string;
}

function CreatePurchaseOrderForm({
  supplierOptions,
  purchaseRequestOptions,
  hotelOptions,
  onDone,
}: {
  supplierOptions: { id: string; name: string }[];
  purchaseRequestOptions: { id: string; description: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createPurchaseOrder = useCreatePurchaseOrder();
  const [supplierId, setSupplierId] = useState("");
  const [purchaseRequestId, setPurchaseRequestId] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", quantity: "1", unitPrice: "" }]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeLine(index: number) {
    setLines((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supplierId) return;
    const validLines = lines
      .filter((line) => line.description && line.quantity && line.unitPrice)
      .map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      }));
    if (validLines.length === 0) return;
    createPurchaseOrder.mutate(
      {
        supplierId,
        purchaseRequestId: purchaseRequestId || undefined,
        lines: validLines,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouvelle commande fournisseur</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-hotel">Hôtel</Label>
          <select
            id="po-hotel"
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
          <Label htmlFor="po-supplier">Fournisseur</Label>
          <select
            id="po-supplier"
            required
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Sélectionner un fournisseur
            </option>
            {supplierOptions.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-request">Demande d'achat (optionnel)</Label>
          <select
            id="po-request"
            value={purchaseRequestId}
            onChange={(event) => setPurchaseRequestId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Aucune</option>
            {purchaseRequestOptions.map((request) => (
              <option key={request.id} value={request.id}>
                {request.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Lignes</Label>
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[1fr_5rem_7rem_auto] items-center gap-2">
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
        <Button type="button" variant="outline" size="sm" onClick={addLine} className="self-start">
          <Icons.IconPlus />
          Ajouter une ligne
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Total : <span className="font-[var(--fw-subtitle-strong)] text-foreground">{fmtGNF(total)}</span>
      </p>

      {createPurchaseOrder.isError ? (
        <p className="text-sm text-destructive">
          {createPurchaseOrder.error instanceof Error ? createPurchaseOrder.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createPurchaseOrder.isPending}>
          {createPurchaseOrder.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ReceiveGoodsForm({
  order,
  supplierName,
  onDone,
}: {
  order: PurchaseOrder;
  supplierName: string;
  onDone: () => void;
}) {
  const createGoodsReceipt = useCreateGoodsReceipt();
  const remaining = (line: PurchaseOrder["lines"][number]) => Number(line.quantity) - Number(line.receivedQuantity);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.lines.map((line) => [line.id, ""]))
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const receiptLines = order.lines
      .map((line) => ({ purchaseOrderLineId: line.id, quantityReceived: Number(quantities[line.id] || 0) }))
      .filter((line) => line.quantityReceived > 0);
    if (receiptLines.length === 0) return;
    createGoodsReceipt.mutate({ purchaseOrderId: order.id, input: { lines: receiptLines } }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>
          Réceptionner — {order.orderNumber ?? "Brouillon"} ({supplierName})
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        {order.lines.map((line) => {
          const lineRemaining = remaining(line);
          return (
            <div key={line.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-[var(--fw-subtitle-strong)]">{line.description}</p>
                <p className="text-xs text-muted-foreground">
                  Commandé : {line.quantity} · Déjà reçu : {line.receivedQuantity} · Restant : {lineRemaining}
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={lineRemaining}
                step="0.01"
                disabled={lineRemaining <= 0}
                className="w-24"
                value={quantities[line.id] ?? ""}
                onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
              />
            </div>
          );
        })}
      </div>

      {createGoodsReceipt.isError ? (
        <p className="text-sm text-destructive">
          {createGoodsReceipt.error instanceof Error ? createGoodsReceipt.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createGoodsReceipt.isPending}>
          {createGoodsReceipt.isPending ? "Enregistrement…" : "Confirmer la réception"}
        </Button>
      </DialogFooter>
    </form>
  );
}
