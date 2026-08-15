import type { Guest } from "@prisma/client";

export function toGuestResponse(guest: Guest) {
  return {
    id: guest.id,
    hotelId: guest.hotelId,
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email,
    phone: guest.phone,
    documentType: guest.documentType,
    documentNumber: guest.documentNumber,
    nationality: guest.nationality,
    address: guest.address,
    preferences: guest.preferences,
    notes: guest.notes,
    isActive: guest.isActive,
    createdAt: guest.createdAt,
  };
}
