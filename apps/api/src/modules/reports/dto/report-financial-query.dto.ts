import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export type ReportGroupBy = "month" | "category" | "department" | "activity";
export type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

const GROUP_BY_VALUES: ReportGroupBy[] = ["month", "category", "department", "activity"];
const FORMAT_VALUES: ReportFormat[] = ["json", "csv", "xlsx", "pdf"];

// "Moteur de rapports paramétrable" (§54) : période (dateFrom/dateTo) + filtres département/
// activité/catégorie, groupement au choix, export CSV/Excel/PDF au choix (format=json par défaut).
export class ReportFinancialQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  activityId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(GROUP_BY_VALUES)
  groupBy?: ReportGroupBy;

  @IsOptional()
  @IsIn(FORMAT_VALUES)
  format?: ReportFormat;
}
