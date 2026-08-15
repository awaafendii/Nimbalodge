import { MaintenanceInterventionType } from "@prisma/client";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

// Modifiable seulement tant que l'intervention est en SCHEDULED (vérifié en service).
export class UpdateMaintenanceInterventionDto {
  @IsOptional()
  @IsEnum(MaintenanceInterventionType)
  type?: MaintenanceInterventionType;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
