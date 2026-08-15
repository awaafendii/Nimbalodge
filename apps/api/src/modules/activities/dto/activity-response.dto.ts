import type { DepartmentActivity } from "@prisma/client";

export function toActivityResponse(activity: DepartmentActivity) {
  return {
    id: activity.id,
    departmentId: activity.departmentId,
    name: activity.name,
    code: activity.code,
    description: activity.description,
    isActive: activity.isActive,
    createdAt: activity.createdAt,
  };
}
