import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateReservationDto {
  @IsString()
  guestId!: string;

  @IsString()
  roomId!: string;

  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  // Optionnel — défaulté à RoomType.baseRate si absent, figé à la création (jamais relu après).
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  agreedRate?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  // Texte libre — ex. "direct"/"phone"/"walk-in", pas de canal codé en dur.
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
