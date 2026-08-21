import { Type, plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty, IsOptional, Max, Min, validateSync } from "class-validator";

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

  // Étape 7 — secret distinct pour le token de challenge 2FA (voir two-factor.service.ts) : jamais
  // partagé avec JWT_ACCESS_SECRET, pour qu'un challenge token ne puisse jamais être accepté comme
  // un vrai access token par JwtAccessStrategy (signature invalide avec le mauvais secret).
  @IsNotEmpty()
  JWT_2FA_CHALLENGE_SECRET!: string;

  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN: string = "15m";

  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string = "7d";

  // Nimba AI (Étape 6) — volontairement optionnelles, contrairement aux secrets JWT ci-dessus :
  // l'app doit toujours démarrer même sans fournisseur LLM configuré (voir GeminiProvider et la
  // matrice d'état de configuration du plan d'architecture Nimba AI). GEMINI_API_KEY n'est jamais
  // exposée au frontend, jamais journalisée.
  @IsOptional()
  @IsNotEmpty()
  LLM_PROVIDER?: string;

  @IsOptional()
  @IsNotEmpty()
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsNotEmpty()
  GEMINI_MODEL?: string;

  // Email transactionnel (réinitialisation de mot de passe) — volontairement optionnelles, même
  // raisonnement que GEMINI_API_KEY ci-dessus : l'app démarre normalement sans elles, le lien de
  // reset reste alors journalisé côté serveur au lieu d'être envoyé (voir password-reset.service.ts
  // et BrevoProvider.isConfigured()). BREVO_API_KEY n'est jamais exposée au frontend, jamais
  // journalisée.
  @IsOptional()
  @IsNotEmpty()
  EMAIL_PROVIDER?: string;

  @IsOptional()
  @IsNotEmpty()
  BREVO_API_KEY?: string;

  // Adresse d'expéditeur — doit être un expéditeur vérifié dans le compte Brevo (voir
  // docs/deployment/render.md). Aucun nom de domaine requis : Brevo permet de vérifier une seule
  // adresse email sans posséder de domaine.
  @IsOptional()
  @IsNotEmpty()
  EMAIL_FROM_ADDRESS?: string;

  @IsOptional()
  @IsNotEmpty()
  EMAIL_FROM_NAME?: string;

  // URL de base du frontend, utilisée pour construire le lien cliquable dans l'email de
  // réinitialisation (ex. https://nimbalodge-web.onrender.com/reset-password?token=...). Optionnelle
  // : PasswordResetService retombe sur CORS_ORIGIN si absente (les deux pointent déjà vers la même
  // origine frontend dans tous les déploiements actuels) — jamais un lien vers localhost en
  // production par accident.
  @IsOptional()
  @IsNotEmpty()
  WEB_APP_URL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Variables d'environnement invalides:\n${errors.toString()}`);
  }
  return validated;
}
