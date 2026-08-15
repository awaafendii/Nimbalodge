import { IsNumber, IsString, Min } from "class-validator";

export class CreateGoodsReceiptLineDto {
  @IsString()
  purchaseOrderLineId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantityReceived!: number;
}
