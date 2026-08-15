import type { Room } from "@prisma/client";

export function toRoomResponse(room: Room) {
  return {
    id: room.id,
    hotelId: room.hotelId,
    roomTypeId: room.roomTypeId,
    number: room.number,
    floor: room.floor,
    building: room.building,
    isActive: room.isActive,
    createdAt: room.createdAt,
  };
}
