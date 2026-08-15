import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateLeaveRequestDto {
  @IsString()
  employeeId!: string;

  // Texte libre — les types de congé varient par pays/convention collective, pas d'enum.
  @IsOptional()
  @IsString()
  type?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
