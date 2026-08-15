import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, ValidateNested } from "class-validator";

import { CreatePurchaseOrderLineDto } from "./create-purchase-order-line.dto";

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId!: string;

  // Optionnelle — une commande directe sans demande préalable reste possible (même logique
  // qu'Invoice.reservationId, Phase 7). Si renseignée, doit référencer une PurchaseRequest APPROVED.
  @IsOptional()
  @IsString()
  purchaseRequestId?: string;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Requis pour un demandeur org-wide ; ignoré (dérivé du demandeur) pour un hôtel-scopé.
  @IsOptional()
  @IsString()
  hotelId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];
}
