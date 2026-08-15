import { IsOptional, IsString } from "class-validator";

// "Historique" (§26) : filtrage simple par actif/chambre, pas de nouveau modèle (voir
// docs/architecture/phase-10-housekeeping-maintenance.md).
export class ListMaintenanceInterventionsQueryDto {
  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;
}
