import { IsString } from "class-validator";

// Ajoute une HotelMembership à un utilisateur EXISTANT — permet un profil multi-hôtel type BOSS
// (rôle différent par hôtel) constitué progressivement depuis l'application, pas seulement via le
// seed. Voir UsersController.addHotelMembership().
export class AddHotelMembershipDto {
  @IsString()
  hotelId!: string;

  @IsString()
  roleId!: string;
}
