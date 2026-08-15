import { IsOptional, IsString } from "class-validator";

export class CreateHousekeepingTaskDto {
  @IsString()
  roomId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
