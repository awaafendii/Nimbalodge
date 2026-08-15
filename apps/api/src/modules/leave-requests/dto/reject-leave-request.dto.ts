import { IsOptional, IsString } from "class-validator";

export class RejectLeaveRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
