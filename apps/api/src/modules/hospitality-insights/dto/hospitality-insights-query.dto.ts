import { IsDateString, IsOptional } from "class-validator";

// Par défaut (aucun des deux renseigné) : HospitalityInsightsService retombe sur le mois civil en
// cours — voir getOccupancySummary(). Utilisé par le dashboard général (occupation temps réel) et
// par le Tool Nimba AI "occupancy-summary" (même service, même calcul, jamais dupliqué).
export class HospitalityInsightsQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
