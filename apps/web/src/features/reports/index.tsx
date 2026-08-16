import { useState } from "react";
import { fmtGNF } from "@nimbalodge/utils";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Icons,
  Input,
  KpiCard,
  Label,
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useDepartments } from "../../hooks/use-departments.js";
import { useFinancialCategories } from "../../hooks/use-finance-entries.js";
import { useDownloadFinancialReport, useFinancialReport } from "../../hooks/use-reports.js";
import type {
  FinancialReportFilters,
  FinancialReportRow,
  ReportExportFormat,
  ReportGroupBy,
} from "../../services/reports.js";

const GROUP_BY_OPTIONS: { value: ReportGroupBy; label: string }[] = [
  { value: "month", label: "Mois" },
  { value: "category", label: "Catégorie" },
  { value: "department", label: "Département" },
  { value: "activity", label: "Activité" },
];

const EXPORT_FORMATS: { value: ReportExportFormat; label: string }[] = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

// Référence de branchement (Étape 4, module 10/11) : moteur de rapports paramétrable (Phase 11) —
// période/dimensions/groupement au choix, export CSV/Excel/PDF en plus de la vue à l'écran. Un
// seul rapport (financier) exposé côté backend à ce jour ; les futurs rapports (occupation, RH…)
// suivront le même patron une fois leurs endpoints ajoutés.
export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-5">
      <FinancialReportCard />
    </div>
  );
}

function FinancialReportCard() {
  const departments = useDepartments();
  const categories = useFinancialCategories();
  const download = useDownloadFinancialReport();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState<ReportGroupBy>("month");
  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const filters: FinancialReportFilters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    groupBy,
    departmentId: departmentId || undefined,
    categoryId: categoryId || undefined,
  };

  const report = useFinancialReport(filters);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapport financier</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-date-from">Du (optionnel)</Label>
            <Input id="report-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-date-to">Au (optionnel)</Label>
            <Input id="report-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-group-by">Grouper par</Label>
            <select
              id="report-group-by"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as ReportGroupBy)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-department">Département (optionnel)</Label>
            <select
              id="report-department"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
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
            <Label htmlFor="report-category">Catégorie (optionnel)</Label>
            <select
              id="report-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Toutes</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <QueryState
          isLoading={report.isLoading}
          error={report.error}
          data={report.data}
          onRetry={() => report.refetch()}
          isEmpty={(data) => data.rows.length === 0}
          emptyTitle="Aucune donnée pour cette période"
          emptyDescription="Ajustez les filtres ci-dessus ou vérifiez qu'il existe des recettes/dépenses sur cette période."
        >
          {(data) => (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiCard icon={<Icons.IconTrend />} iconTone="good" label="Recettes totales" value={fmtGNF(Number(data.totals.totalRevenue))} />
                <KpiCard icon={<Icons.IconWallet />} iconTone="gold" label="Dépenses totales" value={fmtGNF(Number(data.totals.totalExpense))} />
                <KpiCard icon={<Icons.IconWallet />} label="Net" value={fmtGNF(Number(data.totals.net))} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Période {new Date(data.period.dateFrom).toLocaleDateString("fr-FR")} →{" "}
                  {new Date(data.period.dateTo).toLocaleDateString("fr-FR")}
                </p>
                <div className="flex gap-2">
                  {EXPORT_FORMATS.map((option) => (
                    <Button
                      key={option.value}
                      variant="outline"
                      size="sm"
                      disabled={download.isPending}
                      onClick={() => download.mutate({ filters, format: option.value })}
                    >
                      <Icons.IconDownload />
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {(() => {
                const columns: DataTableColumn<FinancialReportRow>[] = [
                  {
                    id: "label",
                    header: "Groupe",
                    sortValue: (row) => row.label,
                    cell: (row) => <span className="font-[var(--fw-subtitle-strong)] text-sm">{row.label}</span>,
                  },
                  {
                    id: "revenue",
                    header: "Recettes",
                    align: "right",
                    sortValue: (row) => Number(row.totalRevenue),
                    cell: (row) => fmtGNF(Number(row.totalRevenue)),
                  },
                  {
                    id: "expense",
                    header: "Dépenses",
                    align: "right",
                    sortValue: (row) => Number(row.totalExpense),
                    cell: (row) => fmtGNF(Number(row.totalExpense)),
                  },
                  {
                    id: "net",
                    header: "Net",
                    align: "right",
                    sortValue: (row) => Number(row.net),
                    cell: (row) => fmtGNF(Number(row.net)),
                  },
                ];
                return (
                  <DataTable
                    columns={columns}
                    data={data.rows}
                    getRowId={(row) => row.key}
                    emptyMessage="Aucune ligne pour ces filtres."
                  />
                );
              })()}
            </div>
          )}
        </QueryState>

        {download.isError ? (
          <p className="text-sm text-destructive">
            {download.error instanceof Error ? download.error.message : "Erreur lors de l'export."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
