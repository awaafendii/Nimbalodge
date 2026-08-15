import type { Reservation } from "@prisma/client";

const MS_PER_NIGHT = 24 * 60 * 60 * 1000;

// Calculés à la demande, jamais stockés — même principe que les totaux Invoice (Phase 6).
export function computeNights(checkInDate: Date, checkOutDate: Date): number {
  return Math.round((checkOutDate.getTime() - checkInDate.getTime()) / MS_PER_NIGHT);
}

export function toReservationResponse(reservation: Reservation) {
  const nights = computeNights(reservation.checkInDate, reservation.checkOutDate);
  return {
    id: reservation.id,
    hotelId: reservation.hotelId,
    guestId: reservation.guestId,
    roomId: reservation.roomId,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    actualCheckInAt: reservation.actualCheckInAt,
    actualCheckOutAt: reservation.actualCheckOutAt,
    adults: reservation.adults,
    children: reservation.children,
    agreedRate: reservation.agreedRate,
    currency: reservation.currency,
    source: reservation.source,
    notes: reservation.notes,
    cancelReason: reservation.cancelReason,
    status: reservation.status,
    createdById: reservation.createdById,
    nights,
    estimatedAmount: reservation.agreedRate.times(nights),
    createdAt: reservation.createdAt,
  };
}
