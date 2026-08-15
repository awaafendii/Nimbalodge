import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

// discountRate/taxRate en fraction (0.18 = 18%), PAS en pourcentage entier.
export class CreateInvoiceLineDto {
  @IsString()
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1)
  discountRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1)
  taxRate?: number;
}
