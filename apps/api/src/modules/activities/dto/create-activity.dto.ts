import { IsOptional, IsString } from "class-validator";

export class CreateActivityDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  departmentId!: string;
}
