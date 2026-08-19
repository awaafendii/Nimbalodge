import { IsString, MinLength } from "class-validator";

export class VerifyTwoFactorDto {
  @IsString()
  @MinLength(1)
  challengeToken!: string;

  // 6 chiffres (TOTP) OU un code de récupération (10 caractères hex) — format non contraint ici,
  // TwoFactorService essaie les deux (voir verifyChallenge()).
  @IsString()
  @MinLength(6)
  code!: string;
}
