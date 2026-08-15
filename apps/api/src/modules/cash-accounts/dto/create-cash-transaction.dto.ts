import { TransactionDirection } from "@prisma/client";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

// Saisie manuelle (ex. approvisionnement de caisse) — distincte des transactions posées
// automatiquement par RevenuesService/ExpensesService.
export class CreateCashTransactionDto {
  @IsEnum(TransactionDirection)
  direction!: TransactionDirection;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  label!: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
