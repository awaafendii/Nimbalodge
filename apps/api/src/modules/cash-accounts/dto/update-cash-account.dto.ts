import { IsBoolean, IsOptional, IsString } from "class-validator";

// Pas d'`openingBalance` en update : le modifier après coup fausserait rétroactivement le solde
// calculé à partir des transactions déjà enregistrées.
export class UpdateCashAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
