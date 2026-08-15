import { IsBoolean, IsOptional, IsString } from "class-validator";

// Pas de changement de `type` en update : reclasserait rétroactivement le sens des Revenue/Expense
// déjà rattachées à cette catégorie.
export class UpdateFinancialCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
