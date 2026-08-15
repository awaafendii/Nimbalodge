import { IsOptional, IsString } from "class-validator";

export class ListStockMovementsQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}
