import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

// RBAC multi-hôtel (audit RBAC multi-hôtel) — un rôle métier créé ici est TOUJOURS attribué via
// HotelMembership (voir UsersService.create()), jamais via UserRole (réservé aux rôles plateforme,
// aujourd'hui uniquement SUPER_ADMIN — voir schema.prisma, commentaire sur Role). `roleId` unique
// (pas `roleIds[]`, remplacé cette étape) : un utilisateur métier a exactement un rôle par hôtel,
// jamais plusieurs rôles cumulés sur le même hôtel.
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  // Requis pour un demandeur org-wide (BOSS/SUPER_ADMIN) ; ignoré (dérivé du demandeur) pour un
  // demandeur hôtel-scopé — même convention que CreateRoomTypeDto/CreateReservationDto/... .
  @IsOptional()
  @IsString()
  hotelId?: string;

  @IsString()
  roleId!: string;
}
