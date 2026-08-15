import type { LeaveRequest } from "@prisma/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Inclusif (jours calendaires d'absence) — convention volontairement différente de
// computeNights() (Reservation), qui est exclusive (nuitées, jour de départ non facturé). Un congé
// se compte en jours calendaires pleins, les deux bornes incluses.
export function computeLeaveDays(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
}

export function toLeaveRequestResponse(leaveRequest: LeaveRequest) {
  return {
    id: leaveRequest.id,
    hotelId: leaveRequest.hotelId,
    employeeId: leaveRequest.employeeId,
    type: leaveRequest.type,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    reason: leaveRequest.reason,
    status: leaveRequest.status,
    approvedById: leaveRequest.approvedById,
    approvedAt: leaveRequest.approvedAt,
    rejectionReason: leaveRequest.rejectionReason,
    createdById: leaveRequest.createdById,
    days: computeLeaveDays(leaveRequest.startDate, leaveRequest.endDate),
    createdAt: leaveRequest.createdAt,
  };
}
