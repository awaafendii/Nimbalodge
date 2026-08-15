import type { HousekeepingTask } from "@prisma/client";

export function toHousekeepingTaskResponse(task: HousekeepingTask) {
  return {
    id: task.id,
    hotelId: task.hotelId,
    roomId: task.roomId,
    status: task.status,
    notes: task.notes,
    createdById: task.createdById,
    cleanedById: task.cleanedById,
    cleanedAt: task.cleanedAt,
    inspectedById: task.inspectedById,
    inspectedAt: task.inspectedAt,
    createdAt: task.createdAt,
  };
}
