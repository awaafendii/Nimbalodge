import type { Warehouse } from "@prisma/client";

export function toWarehouseResponse(warehouse: Warehouse) {
  return {
    id: warehouse.id,
    hotelId: warehouse.hotelId,
    departmentId: warehouse.departmentId,
    name: warehouse.name,
    location: warehouse.location,
    isActive: warehouse.isActive,
    createdAt: warehouse.createdAt,
  };
}
