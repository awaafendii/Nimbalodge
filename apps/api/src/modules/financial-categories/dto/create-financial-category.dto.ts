import { FinancialCategoryType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateFinancialCategoryDto {
  @IsString()
  name!: string;

  @IsEnum(FinancialCategoryType)
  type!: FinancialCategoryType;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
