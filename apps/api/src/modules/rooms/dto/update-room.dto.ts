import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  building?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
