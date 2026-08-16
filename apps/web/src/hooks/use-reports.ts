import { useMutation, useQuery } from "@tanstack/react-query";

import * as reportsService from "../services/reports.js";
import type { FinancialReportFilters, ReportExportFormat } from "../services/reports.js";

export function useFinancialReport(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: ["reports", "financial", filters],
    queryFn: () => reportsService.getFinancialReport(filters),
  });
}

export function useDownloadFinancialReport() {
  return useMutation({
    mutationFn: ({ filters, format }: { filters: FinancialReportFilters; format: ReportExportFormat }) =>
      reportsService.downloadFinancialReport(filters, format),
  });
}
