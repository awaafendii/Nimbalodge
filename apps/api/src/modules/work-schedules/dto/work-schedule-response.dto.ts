import type { WorkSchedule } from "@prisma/client";

export function toWorkScheduleResponse(schedule: WorkSchedule) {
  return {
    id: schedule.id,
    hotelId: schedule.hotelId,
    employeeId: schedule.employeeId,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    notes: schedule.notes,
    createdAt: schedule.createdAt,
  };
}
