import { IsOptional, IsString } from "class-validator";

export class CreateRoomDto {
  @IsString()
  roomTypeId!: string;

  @IsString()
  number!: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  building?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
