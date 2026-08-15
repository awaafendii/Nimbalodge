import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minThreshold?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
