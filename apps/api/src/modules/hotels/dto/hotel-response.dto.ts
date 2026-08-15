import type { Hotel } from "@prisma/client";

export function toHotelResponse(hotel: Hotel) {
  return {
    id: hotel.id,
    organizationId: hotel.organizationId,
    name: hotel.name,
    slug: hotel.slug,
    address: hotel.address,
    phone: hotel.phone,
    email: hotel.email,
    website: hotel.website,
    category: hotel.category,
    timezone: hotel.timezone,
    languages: hotel.languages,
    logoUrl: hotel.logoUrl,
    isActive: hotel.isActive,
    createdAt: hotel.createdAt,
  };
}
