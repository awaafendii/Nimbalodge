import { IsOptional, IsString } from "class-validator";

export class RejectExpenseDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
