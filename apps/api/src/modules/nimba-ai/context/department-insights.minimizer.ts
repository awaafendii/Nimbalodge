import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { DataMinimizer } from "./data-minimizer.interface";

interface FinancialReportRow {
  key: string;
  label: string;
  totalRevenue: Prisma.Decimal;
  totalExpense: Prisma.Decimal;
  net: Prisma.Decimal;
}

export interface DepartmentComparisonRaw {
  period: { dateFrom: Date; dateTo: Date };
  rows: FinancialReportRow[];
  totals: { totalRevenue: Prisma.Decimal; totalExpense: Prisma.Decimal; net: Prisma.Decimal };
}

export interface DepartmentComparisonRow {
  departmentId: string;
  label: string;
  totalRevenue: string;
  totalExpense: string;
  net: string;
}

export interface DepartmentComparisonMinimized {
  period: { from: string; to: string };
  rows: DepartmentComparisonRow[];
  totals: { totalRevenue: string; totalExpense: string; net: string };
}

// Déjà agrégé par département (aucune ligne d'écriture individuelle) — minimisation = conversion
// Decimal → string + renommage `key` en `departmentId` pour rester explicite côté consommateur
// (le champ `key` de ReportsService.financialReport() est générique à tous les groupBy possibles,
// ici toujours un identifiant de département puisque ce Tool force groupBy="department").
@Injectable()
export class DepartmentInsightsMinimizer
  implements DataMinimizer<DepartmentComparisonRaw, DepartmentComparisonMinimized>
{
  minimize(raw: DepartmentComparisonRaw): DepartmentComparisonMinimized {
    return {
      period: { from: raw.period.dateFrom.toISOString(), to: raw.period.dateTo.toISOString() },
      rows: raw.rows.map((row) => ({
        departmentId: row.key,
        label: row.label,
        totalRevenue: row.totalRevenue.toString(),
        totalExpense: row.totalExpense.toString(),
        net: row.net.toString(),
      })),
      totals: {
        totalRevenue: raw.totals.totalRevenue.toString(),
        totalExpense: raw.totals.totalExpense.toString(),
        net: raw.totals.net.toString(),
      },
    };
  }
}
