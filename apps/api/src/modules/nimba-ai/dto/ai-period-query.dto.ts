import { IsDateString, IsOptional } from "class-validator";

// Réutilisé par les Tools dont la sortie est calculée sur une plage de dates (occupation,
// comparaison par département, effectif/absentéisme, congés). finance-summary utilise
// AiMonthQueryDto à la place (granularité mois/année, cohérent avec FinanceSummaryQueryDto).
export class AiPeriodQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
