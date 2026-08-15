import type { Department } from "@prisma/client";

export function toDepartmentResponse(department: Department) {
  return {
    id: department.id,
    hotelId: department.hotelId,
    name: department.name,
    code: department.code,
    description: department.description,
    managerId: department.managerId,
    isActive: department.isActive,
    createdAt: department.createdAt,
  };
}
