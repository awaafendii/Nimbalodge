import { FinancialCategoryType } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateBudgetLineDto {
  // Requis indépendamment de `categoryId` — résout l'ambiguïté revenue/expense quand une ligne
  // cible uniquement un département/activité/centre de coût sans catégorie précise.
  @IsEnum(FinancialCategoryType)
  type!: FinancialCategoryType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  plannedAmount!: number;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  activityId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
