import { Type, plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty, Max, Min, validateSync } from "class-validator";

class EnvironmentVariables {
  @IsIn(["development", "production", "test"])
  NODE_ENV: string = "development";

  // `@Type(() => Number)` est nécessaire malgré `enableImplicitConversion` : sans annotation de
  // type explicite ni décorateur de conversion, class-transformer ne coerce pas de façon fiable
  // la string d'environnement ("4000") en number avant que class-validator n'exécute @IsInt().
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT: number = 4000;

  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsNotEmpty()
  CORS_ORIGIN!: string;

  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN: string = "15m";

  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string = "7d";
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Variables d'environnement invalides:\n${errors.toString()}`);
  }
  return validated;
}
