import { MaintenanceInterventionType } from "@prisma/client";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateMaintenanceInterventionDto {
  @IsEnum(MaintenanceInterventionType)
  type!: MaintenanceInterventionType;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  // Optionnel — une intervention PREVENTIVE est typiquement planifiée sans demande préalable ; si
  // renseigné, doit référencer une MaintenanceRequest APPROVED (même logique que
  // PurchaseOrder.purchaseRequestId, Phase 9).
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

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
