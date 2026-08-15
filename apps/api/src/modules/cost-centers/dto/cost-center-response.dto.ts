import type { CostCenter } from "@prisma/client";

export function toCostCenterResponse(costCenter: CostCenter) {
  return {
    id: costCenter.id,
    hotelId: costCenter.hotelId,
    departmentId: costCenter.departmentId,
    code: costCenter.code,
    name: costCenter.name,
    description: costCenter.description,
    isActive: costCenter.isActive,
    createdAt: costCenter.createdAt,
  };
}
