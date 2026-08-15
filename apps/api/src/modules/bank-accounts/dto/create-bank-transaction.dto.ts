import { TransactionDirection } from "@prisma/client";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateBankTransactionDto {
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
