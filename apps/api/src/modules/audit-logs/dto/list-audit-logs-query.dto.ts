import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  // Ignoré si le demandeur est déjà lié à un seul hôtel (voir AuditLogsService.list) — ne permet
  // qu'à un utilisateur org-wide (hotelId JWT null) de restreindre volontairement à un hôtel donné,
  // jamais d'en sortir.
  @IsOptional()
  @IsString()
  hotelId?: string;

  // Recherche libre sur méthode + chemin + type de ressource + action (voir buildSearchClause côté
  // service) — un seul champ texte plutôt que d'exposer chaque colonne indexable séparément, cohérent
  // avec le DataTable "searchableText" client déjà utilisé sur les ~14 autres écrans.
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // Plafonné à 100 : AuditLog n'a pas de borne métier naturelle (contrairement aux ~40 autres
  // ressources dont le volume suit l'activité humaine) — une pageSize non plafonnée serait un vecteur
  // de déni de service trivial sur l'endpoint le plus lisible de toute l'API.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
