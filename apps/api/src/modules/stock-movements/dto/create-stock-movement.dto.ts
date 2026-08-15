import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

const SIMPLE_TYPES = ["IN", "OUT", "CONSUMPTION", "LOSS"] as const;
export type SimpleStockMovementType = (typeof SIMPLE_TYPES)[number];

// TRANSFER et ADJUSTMENT ont chacun leur propre DTO (structure différente : deux entrepôts pour
// l'un, quantité signée pour l'autre) — voir create-transfer.dto.ts / create-adjustment.dto.ts.
export class CreateStockMovementDto {
  @IsIn(SIMPLE_TYPES)
  type!: SimpleStockMovementType;

  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Complète (Phase 9) une réception fournisseur par un mouvement IN — création manuelle
  // uniquement, non validé comme obligatoire même pour type=IN.
  @IsOptional()
  @IsString()
  goodsReceiptId?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;
}
