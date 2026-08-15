import { PaymentMethod } from "@prisma/client";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateExpenseDto {
  @IsString()
  categoryId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  // vendorName reste (texte libre) ; supplierId (Phase 9) le COMPLÈTE, ne le remplace pas — même
  // principe qu'Invoice.guestId vs clientName (Phase 6/7).
  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  // "Facture fournisseur" (§23) : lien optionnel vers le bon de commande dont cette dépense
  // constate la réception facturée.
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  // Optionnels à la création (peuvent être renseignés/modifiés tant que la dépense est en DRAFT) ;
  // exactement un des deux requis avant mark-paid.
  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  activityId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  attachmentReference?: string;

  @IsOptional()
  @IsString()
  hotelId?: string;
}
