import type { RoomType } from "@prisma/client";

export function toRoomTypeResponse(roomType: RoomType) {
  return {
    id: roomType.id,
    hotelId: roomType.hotelId,
    name: roomType.name,
    code: roomType.code,
    description: roomType.description,
    baseRate: roomType.baseRate,
    currency: roomType.currency,
    capacity: roomType.capacity,
    isActive: roomType.isActive,
    createdAt: roomType.createdAt,
  };
}
