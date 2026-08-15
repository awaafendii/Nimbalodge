import { BudgetPeriod } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class CreateBudgetDto {
  @IsString()
  name!: string;

  @IsEnum(BudgetPeriod)
  periodType!: BudgetPeriod;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  hotelId?: string;
}
