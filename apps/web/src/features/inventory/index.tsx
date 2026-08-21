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
import { useDepartments } from "../../hooks/use-departments.js";
import { useHotels } from "../../hooks/use-hotels.js";
import { usePermission } from "../../hooks/use-permission.js";
import { useCreateProduct, useProductStock, useProducts, useUpdateProduct } from "../../hooks/use-products.js";
import {
  useCreateAdjustment,
  useCreateStockMovement,
  useCreateTransfer,
  useStockMovements,
} from "../../hooks/use-stock-movements.js";
import { useCreateWarehouse, useUpdateWarehouse, useWarehouses } from "../../hooks/use-warehouses.js";
import type { Product } from "../../services/products.js";
import type { SimpleStockMovementType, StockMovement, StockMovementType } from "../../services/stock-movements.js";
import type { Warehouse } from "../../services/warehouses.js";
import { useAuthStore } from "../../stores/auth-store.js";

const SIMPLE_MOVEMENT_TYPES: SimpleStockMovementType[] = ["IN", "OUT", "CONSUMPTION", "LOSS"];
type MovementKind = StockMovementType;
const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  IN: "Entrée",
  OUT: "Sortie",
  CONSUMPTION: "Consommation",
  LOSS: "Perte",
  TRANSFER: "Transfert entre entrepôts",
  ADJUSTMENT: "Ajustement d'inventaire",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

// Ancien point d'entrée unique /inventory — remplacé par une architecture module → sous-module
// (Stocks devient un parent avec un écran dédié par sous-ressource, voir features/stocks/), même
// logique que Finance/RH. Entrepôts/Produits sont des catalogues (comme Guest/RoomType) créés
// avant que des mouvements ne puissent les référencer, conservé tel quel.
export function WarehousesCard() {
  const user = useAuthStore((s) => s.user);
  const warehouses = useWarehouses();
  const updateWarehouse = useUpdateWarehouse();
  const departments = useDepartments();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCreate = usePermission("warehouses.create");
  const canUpdate = usePermission("warehouses.update");

  const departmentNameById = new Map((departments.data ?? []).map((department) => [department.id, department.name]));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Entrepôts</CardTitle>
        {canCreate ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Icons.IconPlus />
                Ajouter un entrepôt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateWarehouseForm
                departmentOptions={departments.data ?? []}
                hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
                onDone={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={warehouses.isLoading}
          error={warehouses.error}
          data={warehouses.data}
          onRetry={() => warehouses.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun entrepôt configuré"
          emptyDescription="Créez votre premier entrepôt pour commencer à suivre le stock."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Icons.IconPlus />
                Ajouter un entrepôt
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<Warehouse>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (warehouse) => warehouse.name.toLowerCase(),
                cell: (warehouse) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{warehouse.name}</span>
                    {!warehouse.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                  </div>
                ),
              },
              {
                id: "department",
                header: "Département",
                cell: (warehouse) =>
                  warehouse.departmentId ? (departmentNameById.get(warehouse.departmentId) ?? "—") : "—",
              },
              {
                id: "location",
                header: "Emplacement",
                cell: (warehouse) => warehouse.location ?? "—",
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (warehouse) =>
                  canUpdate ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updateWarehouse.isPending}
                      onClick={() =>
                        updateWarehouse.mutate({ id: warehouse.id, input: { isActive: !warehouse.isActive } })
                      }
                    >
                      {warehouse.isActive ? "Désactiver" : "Réactiver"}
                    </Button>
                  ) : null,
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(warehouse) => warehouse.id}
                searchableText={(warehouse) => warehouse.name}
                searchPlaceholder="Rechercher un entrepôt…"
                emptyMessage="Aucun entrepôt ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateWarehouseForm({
  departmentOptions,
  hotelOptions,
  onDone,
}: {
  departmentOptions: { id: string; name: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createWarehouse = useCreateWarehouse();
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [location, setLocation] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name) return;
    createWarehouse.mutate(
      {
        name,
        departmentId: departmentId || undefined,
        location: location || undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un entrepôt</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="warehouse-hotel">Hôtel</Label>
          <select
            id="warehouse-hotel"
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
        <Label htmlFor="warehouse-name">Nom</Label>
        <Input id="warehouse-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="warehouse-department">Département (optionnel)</Label>
          <select
            id="warehouse-department"
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="warehouse-location">Emplacement (optionnel)</Label>
          <Input id="warehouse-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      {createWarehouse.isError ? (
        <p className="text-sm text-destructive">
          {createWarehouse.error instanceof Error ? createWarehouse.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createWarehouse.isPending}>
          {createWarehouse.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProductsCard() {
  const user = useAuthStore((s) => s.user);
  const products = useProducts();
  const updateProduct = useUpdateProduct();
  const hotels = useHotels();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const canCreate = usePermission("products.create");
  const canUpdate = usePermission("products.update");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Produits</CardTitle>
        {canCreate ? (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Icons.IconPlus />
                Ajouter un produit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateProductForm
                hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
                onDone={() => setCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={products.isLoading}
          error={products.error}
          data={products.data}
          onRetry={() => products.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun produit enregistré"
          emptyDescription="Ajoutez votre premier produit pour commencer à suivre le stock."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Icons.IconPlus />
                Ajouter un produit
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<Product>[] = [
              {
                id: "name",
                header: "Nom",
                sortValue: (product) => product.name.toLowerCase(),
                cell: (product) => (
                  <div className="flex items-center gap-2">
                    <span className="font-[var(--fw-subtitle-strong)] text-sm">{product.name}</span>
                    {product.sku ? <Badge variant="secondary">{product.sku}</Badge> : null}
                    {!product.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                  </div>
                ),
              },
              {
                id: "category",
                header: "Catégorie",
                cell: (product) => product.category ?? "—",
              },
              {
                id: "unit",
                header: "Unité",
                cell: (product) => product.unit ?? "—",
              },
              {
                id: "threshold",
                header: "Seuil d'alerte",
                align: "right",
                sortValue: (product) => Number(product.minThreshold ?? 0),
                cell: (product) => (product.minThreshold ? product.minThreshold : "—"),
              },
              {
                id: "actions",
                header: "",
                align: "right",
                cell: (product) => (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStockTarget(product)}>
                      Voir le stock
                    </Button>
                    {canUpdate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateProduct.isPending}
                        onClick={() => updateProduct.mutate({ id: product.id, input: { isActive: !product.isActive } })}
                      >
                        {product.isActive ? "Désactiver" : "Réactiver"}
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
                getRowId={(product) => product.id}
                searchableText={(product) => `${product.name} ${product.sku ?? ""} ${product.category ?? ""}`}
                searchPlaceholder="Rechercher un produit…"
                emptyMessage="Aucun produit ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>

      <Dialog open={stockTarget !== null} onOpenChange={(open) => !open && setStockTarget(null)}>
        <DialogContent>{stockTarget ? <ProductStockView product={stockTarget} /> : null}</DialogContent>
      </Dialog>
    </Card>
  );
}

function ProductStockView({ product }: { product: Product }) {
  const stock = useProductStock(product.id);
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Stock — {product.name}</DialogTitle>
      </DialogHeader>
      <QueryState isLoading={stock.isLoading} error={stock.error} data={stock.data}>
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.byWarehouse.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun mouvement enregistré pour ce produit.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.byWarehouse.map((entry) => (
                  <li key={entry.warehouseId} className="flex items-center justify-between py-2 text-sm">
                    <span>{entry.warehouseName}</span>
                    <span className="font-[var(--fw-subtitle-strong)]">
                      {entry.quantity} {product.unit ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="font-[var(--fw-subtitle-strong)]">Total</span>
              <span className="font-[var(--fw-subtitle-strong)]">
                {data.total} {product.unit ?? ""}
              </span>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

function CreateProductForm({
  hotelOptions,
  onDone,
}: {
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createProduct = useCreateProduct();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [hotelId, setHotelId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name) return;
    createProduct.mutate(
      {
        name,
        sku: sku || undefined,
        unit: unit || undefined,
        category: category || undefined,
        minThreshold: minThreshold ? Number(minThreshold) : undefined,
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Ajouter un produit</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-hotel">Hôtel</Label>
          <select
            id="product-hotel"
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
        <Label htmlFor="product-name">Nom</Label>
        <Input id="product-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-sku">SKU (optionnel)</Label>
          <Input id="product-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-unit">Unité (optionnel)</Label>
          <Input id="product-unit" placeholder="kg, L, unité…" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-category">Catégorie (optionnel)</Label>
          <Input id="product-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-threshold">Seuil d'alerte (optionnel)</Label>
          <Input
            id="product-threshold"
            type="number"
            min={0}
            step="0.01"
            value={minThreshold}
            onChange={(e) => setMinThreshold(e.target.value)}
          />
        </div>
      </div>

      {createProduct.isError ? (
        <p className="text-sm text-destructive">
          {createProduct.error instanceof Error ? createProduct.error.message : "Erreur inattendue."}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={createProduct.isPending}>
          {createProduct.isPending ? "Création…" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StockMovementsCard() {
  const user = useAuthStore((s) => s.user);
  const movements = useStockMovements();
  const products = useProducts();
  const warehouses = useWarehouses();
  const hotels = useHotels();
  const [dialogOpen, setDialogOpen] = useState(false);

  const productNameById = new Map((products.data ?? []).map((product) => [product.id, product.name]));
  const warehouseNameById = new Map((warehouses.data ?? []).map((warehouse) => [warehouse.id, warehouse.name]));

  const canCreate = usePermission("stock-movements.create");
  const prerequisitesMet = (products.data ?? []).length > 0 && (warehouses.data ?? []).length > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Mouvements de stock</CardTitle>
        {canCreate ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!prerequisitesMet}>
                <Icons.IconPlus />
                Nouveau mouvement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateMovementForm
                productOptions={products.data ?? []}
                warehouseOptions={warehouses.data ?? []}
                hotelOptions={!user?.hotel ? (hotels.data ?? []) : []}
                onDone={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={movements.isLoading}
          error={movements.error}
          data={movements.data}
          onRetry={() => movements.refetch()}
          isEmpty={(data) => data.length === 0}
          emptyTitle="Aucun mouvement de stock enregistré"
          emptyDescription={
            !prerequisitesMet
              ? "Ajoutez d'abord un entrepôt et un produit ci-dessus."
              : "Enregistrez votre premier mouvement de stock."
          }
          emptyAction={
            canCreate && prerequisitesMet ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Icons.IconPlus />
                Nouveau mouvement
              </Button>
            ) : undefined
          }
        >
          {(data) => {
            const columns: DataTableColumn<StockMovement>[] = [
              {
                id: "date",
                header: "Date",
                sortValue: (movement) => movement.date,
                cell: (movement) => formatDate(movement.date),
              },
              {
                id: "product",
                header: "Produit",
                sortValue: (movement) => productNameById.get(movement.productId) ?? "",
                cell: (movement) => productNameById.get(movement.productId) ?? "—",
              },
              {
                id: "warehouse",
                header: "Entrepôt",
                cell: (movement) =>
                  movement.type === "TRANSFER" && movement.toWarehouseId
                    ? `${warehouseNameById.get(movement.warehouseId) ?? "—"} → ${warehouseNameById.get(movement.toWarehouseId) ?? "—"}`
                    : (warehouseNameById.get(movement.warehouseId) ?? "—"),
              },
              {
                id: "type",
                header: "Type",
                cell: (movement) => <Badge variant="secondary">{MOVEMENT_KIND_LABELS[movement.type]}</Badge>,
              },
              {
                id: "quantity",
                header: "Quantité",
                align: "right",
                sortValue: (movement) => Number(movement.quantity),
                cell: (movement) => {
                  const negative = movement.type === "OUT" || movement.type === "CONSUMPTION" || movement.type === "LOSS";
                  const value = Number(movement.quantity);
                  const sign = movement.type === "ADJUSTMENT" ? (value >= 0 ? "+" : "") : negative ? "-" : "+";
                  return `${sign}${movement.quantity}`;
                },
              },
            ];
            return (
              <DataTable
                columns={columns}
                data={data}
                getRowId={(movement) => movement.id}
                searchableText={(movement) => productNameById.get(movement.productId) ?? ""}
                searchPlaceholder="Rechercher par produit…"
                emptyMessage="Aucun mouvement ne correspond à cette recherche."
              />
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CreateMovementForm({
  productOptions,
  warehouseOptions,
  hotelOptions,
  onDone,
}: {
  productOptions: { id: string; name: string }[];
  warehouseOptions: { id: string; name: string }[];
  hotelOptions: { id: string; name: string }[];
  onDone: () => void;
}) {
  const createMovement = useCreateStockMovement();
  const createTransfer = useCreateTransfer();
  const createAdjustment = useCreateAdjustment();
  const [kind, setKind] = useState<MovementKind>("IN");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [hotelId, setHotelId] = useState("");

  const isPending = createMovement.isPending || createTransfer.isPending || createAdjustment.isPending;
  const error = createMovement.error ?? createTransfer.error ?? createAdjustment.error;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!productId || !warehouseId || !quantity) return;

    if (kind === "TRANSFER") {
      if (!toWarehouseId) return;
      createTransfer.mutate(
        {
          productId,
          fromWarehouseId: warehouseId,
          toWarehouseId,
          quantity: Number(quantity),
          hotelId: hotelId || undefined,
        },
        { onSuccess: onDone }
      );
      return;
    }

    if (kind === "ADJUSTMENT") {
      createAdjustment.mutate(
        {
          productId,
          warehouseId,
          quantity: Number(quantity),
          reason: reason || undefined,
          hotelId: hotelId || undefined,
        },
        { onSuccess: onDone }
      );
      return;
    }

    createMovement.mutate(
      {
        type: kind as SimpleStockMovementType,
        productId,
        warehouseId,
        quantity: Number(quantity),
        hotelId: hotelId || undefined,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Nouveau mouvement de stock</DialogTitle>
      </DialogHeader>

      {hotelOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="movement-hotel">Hôtel</Label>
          <select
            id="movement-hotel"
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
        <Label htmlFor="movement-kind">Type de mouvement</Label>
        <select
          id="movement-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as MovementKind)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          {[...SIMPLE_MOVEMENT_TYPES, "TRANSFER", "ADJUSTMENT"].map((type) => (
            <option key={type} value={type}>
              {MOVEMENT_KIND_LABELS[type as MovementKind]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="movement-product">Produit</Label>
        <select
          id="movement-product"
          required
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Sélectionner un produit
          </option>
          {productOptions.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="movement-warehouse">{kind === "TRANSFER" ? "Entrepôt source" : "Entrepôt"}</Label>
          <select
            id="movement-warehouse"
            required
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Sélectionner
            </option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        {kind === "TRANSFER" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movement-to-warehouse">Entrepôt destination</Label>
            <select
              id="movement-to-warehouse"
              required
              value={toWarehouseId}
              onChange={(event) => setToWarehouseId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Sélectionner
              </option>
              {warehouseOptions
                .filter((warehouse) => warehouse.id !== warehouseId)
                .map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movement-quantity">Quantité{kind === "ADJUSTMENT" ? " (peut être négative)" : ""}</Label>
            <Input
              id="movement-quantity"
              type="number"
              min={kind === "ADJUSTMENT" ? undefined : 0.01}
              step="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        )}
      </div>

      {kind === "TRANSFER" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="movement-quantity-transfer">Quantité</Label>
          <Input
            id="movement-quantity-transfer"
            type="number"
            min={0.01}
            step="0.01"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
      ) : null}

      {kind === "ADJUSTMENT" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="movement-reason">Motif (optionnel)</Label>
          <Input id="movement-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Erreur inattendue."}</p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
