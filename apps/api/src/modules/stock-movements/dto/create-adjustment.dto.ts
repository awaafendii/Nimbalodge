import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

// Seul type où `quantity` est signée (une correction d'inventaire physique peut aller dans les
// deux sens) — non-nullité vérifiée en service, pas via un décorateur dédié.
export class CreateAdjustmentDto {
  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  hotelId?: string;
}
