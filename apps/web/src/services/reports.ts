import { apiClient } from "./api-client.js";

export type ReportGroupBy = "month" | "category" | "department" | "activity";
export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export interface FinancialReportFilters {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  categoryId?: string;
  groupBy?: ReportGroupBy;
}

export interface FinancialReportRow {
  key: string;
  label: string;
  totalRevenue: string;
  totalExpense: string;
  net: string;
}

export interface FinancialReport {
  period: { dateFrom: string; dateTo: string };
  groupBy: ReportGroupBy;
  filters: Record<string, string>;
  rows: FinancialReportRow[];
  totals: { totalRevenue: string; totalExpense: string; net: string };
}

function buildQuery(filters: FinancialReportFilters, format?: ReportExportFormat): string {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.groupBy) params.set("groupBy", filters.groupBy);
  if (format) params.set("format", format);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getFinancialReport(filters: FinancialReportFilters): Promise<FinancialReport> {
  return apiClient.get<FinancialReport>(`/reports/financial${buildQuery(filters)}`);
}

export async function downloadFinancialReport(
  filters: FinancialReportFilters,
  format: ReportExportFormat
): Promise<void> {
  const { blob, filename } = await apiClient.getBlob(`/reports/financial${buildQuery(filters, format)}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
