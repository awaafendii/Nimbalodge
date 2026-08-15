import { IsOptional, IsString } from "class-validator";

// Modifiable seulement tant que la demande est en PENDING (vérifié en service).
export class UpdateMaintenanceRequestDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;
}
