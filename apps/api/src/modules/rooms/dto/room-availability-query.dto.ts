import { IsDateString, IsOptional, IsString } from "class-validator";

export class RoomAvailabilityQueryDto {
  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;

  @IsOptional()
  @IsString()
  roomTypeId?: string;
}
