import { IsOptional, IsString } from "class-validator";

export class RejectPurchaseRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
