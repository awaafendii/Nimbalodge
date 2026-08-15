import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateCreditNoteDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  // Remboursement optionnel : au plus un des deux (pas les deux à la fois), aucun = avoir sur
  // papier uniquement.
  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;
}
