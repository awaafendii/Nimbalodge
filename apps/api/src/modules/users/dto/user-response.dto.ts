import type { Hotel, HotelMembership, Role, User } from "@prisma/client";

// Mapping explicite plutôt que class-transformer @Exclude : les objets renvoyés par Prisma sont
// des objets simples, pas des instances de classe — @Exclude ne s'appliquerait pas sans un
// plainToInstance() explicite. Exclut toujours passwordHash et twoFactorSecret.
export interface UserHotelMembershipResponse {
  hotelId: string;
  hotelName: string;
  roleId: string;
  roleName: string;
  status: string;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  organizationId: string;
  hotelId: string | null;
  createdAt: Date;
  // RBAC multi-hôtel (audit RBAC multi-hôtel) — rôles métier réellement accordés, un par hôtel.
  // Absent/vide pour un utilisateur org-wide sans membership (ex. SUPER_ADMIN).
  hotelMemberships: UserHotelMembershipResponse[];
}

export type UserWithMemberships = User & {
  hotelMemberships: (HotelMembership & { hotel: Hotel; role: Role })[];
};

export function toUserResponse(user: UserWithMemberships): UserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    organizationId: user.organizationId,
    hotelId: user.hotelId,
    createdAt: user.createdAt,
    hotelMemberships: user.hotelMemberships.map((m) => ({
      hotelId: m.hotelId,
      hotelName: m.hotel.name,
      roleId: m.roleId,
      roleName: m.role.name,
      status: m.status,
    })),
  };
}
