import { IsString } from "class-validator";

export class SwitchHotelDto {
  @IsString()
  hotelId!: string;
}
