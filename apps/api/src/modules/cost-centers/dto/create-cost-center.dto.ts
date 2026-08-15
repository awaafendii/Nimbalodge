import { IsOptional, IsString } from "class-validator";

export class CreateCostCenterDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Nullable : un centre de coût peut être transverse (ex. "Administration générale"), pas
  // systématiquement rattaché à un département unique.
  @IsOptional()
  @IsString()
  departmentId?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
