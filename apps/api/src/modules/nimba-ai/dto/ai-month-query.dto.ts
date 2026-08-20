import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

// Même validation que FinanceSummaryQueryDto (Phase 5) — pour le Tool finance-summary
// (FinanceInsightsTool), qui enveloppe directement FinanceSummaryService.getSummary().
export class AiMonthQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;
}
