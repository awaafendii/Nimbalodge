import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateHotelDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  // §48 : le département "Administration générale" est un choix proposé à la création, pas un
  // comportement caché — modifiable/renommable/désactivable ensuite comme n'importe quel autre.
  @IsOptional()
  @IsBoolean()
  createDefaultDepartment?: boolean;
}
