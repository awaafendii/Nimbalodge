import { PaymentMethod } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class MarkPaidPayslipDto {
  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  // Explicite — pas dérivé de la présence caisse/banque, même principe que CreateExpenseDto.
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsString()
  categoryId!: string;

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
  reference?: string;
}
