import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateAttendanceDto {
  @IsString()
  employeeId!: string;

  // Optionnel — défaulté à now() si absent (pointage en direct vs saisie rétroactive par RH).
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
