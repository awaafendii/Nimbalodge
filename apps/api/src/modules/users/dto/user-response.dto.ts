import type { User } from "@prisma/client";

// Mapping explicite plutôt que class-transformer @Exclude : les objets renvoyés par Prisma sont
// des objets simples, pas des instances de classe — @Exclude ne s'appliquerait pas sans un
// plainToInstance() explicite. Exclut toujours passwordHash et twoFactorSecret.
export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  organizationId: string;
  hotelId: string | null;
  createdAt: Date;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    organizationId: user.organizationId,
    hotelId: user.hotelId,
    createdAt: user.createdAt,
  };
}
