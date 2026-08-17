import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";

import { cn } from "../lib/utils.js";
import { Checkbox } from "./checkbox.js";
import { Input } from "./input.js";
import { Pagination } from "./pagination.js";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  // Absent = colonne non triable. Retourne la valeur brute à comparer, pas un ReactNode.
  sortValue?: (row: T) => string | number | Date;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  // Absent = pas de barre de recherche (toutes les listes n'en ont pas besoin).
  searchableText?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  // Emplacement pour les actions/filtres additionnels (ex. bouton "+ Ajouter", export) — rendu à
  // côté de la recherche, jamais imposé par le composant lui-même.
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  // Distinct de l'état "aucune donnée" de QueryState (en amont) : ici, des données existent mais
  // aucune ne correspond aux critères de recherche courants sur cette page.
  emptyMessage?: string;
  // Sous md (voir le rendu en cartes plus bas), un rendu carte sur-mesure pour cet écran — sinon
  // repli générique automatique (une carte par ligne, une paire label/valeur par colonne), qui
  // fonctionne pour tous les appelants sans aucun changement de leur part.
  renderMobileCard?: (row: T) => React.ReactNode;
}

type SortDirection = "asc" | "desc" | null;

// Tri/recherche/pagination entièrement côté client — le backend n'expose aucune pagination
// serveur à ce jour (voir docs/architecture/audit-master-prompt-v2.md section Q : chaque liste
// charge l'intégralité des lignes). Ce composant est le seul endroit où cette logique vit ; le
// jour où une pagination serveur existera, seul ce fichier change, pas les ~14 écrans qui
// l'utilisent.
export function DataTable<T>({
  columns,
  data,
  getRowId,
  searchableText,
  searchPlaceholder = "Rechercher…",
  pageSize = 20,
  selectable = false,
  selectedIds,
  onSelectedIdsChange,
  toolbar,
  onRowClick,
  emptyMessage = "Aucun résultat pour ces critères.",
  renderMobileCard,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [sortColumnId, setSortColumnId] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    if (!searchableText || !search.trim()) {
      return data;
    }
    const needle = search.trim().toLowerCase();
    return data.filter((row) => searchableText(row).toLowerCase().includes(needle));
  }, [data, search, searchableText]);

  const sortColumn = columns.find((column) => column.id === sortColumnId);

  const sorted = React.useMemo(() => {
    if (!sortColumn?.sortValue || !sortDirection) {
      return filtered;
    }
    const sortValue = sortColumn.sortValue;
    return [...filtered].sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);
      if (left < right) return sortDirection === "asc" ? -1 : 1;
      if (left > right) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortColumn, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  function toggleSort(columnId: string) {
    if (sortColumnId !== columnId) {
      setSortColumnId(columnId);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortColumnId(null);
    setSortDirection(null);
  }

  const allPageSelected =
    selectable && pageRows.length > 0 && pageRows.every((row) => selectedIds?.has(getRowId(row)));

  function toggleSelectAllOnPage() {
    if (!onSelectedIdsChange) return;
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageRows.forEach((row) => next.delete(getRowId(row)));
    } else {
      pageRows.forEach((row) => next.add(getRowId(row)));
    }
    onSelectedIdsChange(next);
  }

  function toggleSelectRow(id: string) {
    if (!onSelectedIdsChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedIdsChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {searchableText || toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {searchableText ? (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar}
        </div>
      ) : null}

      {/* ≥ md : tableau classique. < md : repli en cartes (voir bloc dédié plus bas) — deux rendus
          de la même page de données, jamais les deux à la fois, aucun changement requis chez les
          ~14 écrans consommateurs. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs font-[var(--fw-subtitle-strong)] uppercase tracking-wide text-muted-foreground">
            <tr>
              {selectable ? (
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleSelectAllOnPage}
                    aria-label="Tout sélectionner sur cette page"
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    "px-3 py-2",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                    column.sortValue && "cursor-pointer select-none",
                    column.className
                  )}
                  onClick={column.sortValue ? () => toggleSort(column.id) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.header}
                    {column.sortValue ? (
                      sortColumnId === column.id ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const id = getRowId(row);
                return (
                  <tr
                    key={id}
                    className={cn("bg-background", onRowClick && "cursor-pointer hover:bg-secondary/40")}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable ? (
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds?.has(id) ?? false}
                          onCheckedChange={() => toggleSelectRow(id)}
                          aria-label="Sélectionner la ligne"
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          "px-3 py-2",
                          column.align === "right" && "text-right",
                          column.align === "center" && "text-center",
                          column.className
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {pageRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          pageRows.map((row) => {
            const id = getRowId(row);
            if (renderMobileCard) {
              return <React.Fragment key={id}>{renderMobileCard(row)}</React.Fragment>;
            }
            return (
              <div
                key={id}
                className={cn(
                  "flex flex-col gap-2.5 rounded-lg border border-border bg-background p-3",
                  onRowClick && "cursor-pointer active:bg-secondary/40"
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {selectable ? (
                  <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds?.has(id) ?? false}
                      onCheckedChange={() => toggleSelectRow(id)}
                      aria-label="Sélectionner la ligne"
                    />
                  </div>
                ) : null}
                {columns.map((column) => (
                  <div key={column.id} className="flex flex-col gap-0.5">
                    {column.header ? (
                      <span className="text-[11px] font-[var(--fw-subtitle-strong)] uppercase tracking-wide text-muted-foreground">
                        {column.header}
                      </span>
                    ) : null}
                    <div className="text-sm">{column.cell(row)}</div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <Pagination page={clampedPage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
