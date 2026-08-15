import type { Attendance } from "@prisma/client";

export function toAttendanceResponse(attendance: Attendance) {
  return {
    id: attendance.id,
    hotelId: attendance.hotelId,
    employeeId: attendance.employeeId,
    clockIn: attendance.clockIn,
    clockOut: attendance.clockOut,
    notes: attendance.notes,
    createdAt: attendance.createdAt,
  };
}
