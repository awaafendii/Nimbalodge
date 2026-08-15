import { IsDateString, IsOptional, IsString } from "class-validator";

// Seulement autorisé tant que la demande est PENDING (miroir DRAFT-only-edit d'Invoice/Expense).
export class UpdateLeaveRequestDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
