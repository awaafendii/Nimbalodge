import { IsNumber, IsOptional, IsString, Min } from "class-validator";

// Modifiable seulement tant que la demande est en PENDING (vérifié en service).
export class UpdatePurchaseRequestDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  estimatedAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
