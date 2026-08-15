import { IsOptional, IsString } from "class-validator";

export class CreateWarehouseDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
