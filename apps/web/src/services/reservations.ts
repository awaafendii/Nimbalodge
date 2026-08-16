import { apiClient } from "./api-client.js";

export type ReservationStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

export interface Reservation {
  id: string;
  hotelId: string;
  guestId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckInAt: string | null;
  actualCheckOutAt: string | null;
  adults: number;
  children: number;
  agreedRate: string;
  currency: string;
  source: string | null;
  notes: string | null;
  cancelReason: string | null;
  status: ReservationStatus;
  createdById: string;
  nights: number;
  estimatedAmount: string;
  createdAt: string;
}

export interface CreateReservationInput {
  guestId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
  agreedRate?: number;
  currency?: string;
  source?: string;
  notes?: string;
  hotelId?: string;
}

export function listReservations(): Promise<Reservation[]> {
  return apiClient.get<Reservation[]>("/reservations");
}

export function createReservation(input: CreateReservationInput): Promise<Reservation> {
  return apiClient.post<Reservation>("/reservations", input);
}

export function confirmReservation(id: string): Promise<Reservation> {
  return apiClient.post<Reservation>(`/reservations/${id}/confirm`);
}

export function checkInReservation(id: string): Promise<Reservation> {
  return apiClient.post<Reservation>(`/reservations/${id}/check-in`);
}

export function checkOutReservation(id: string): Promise<Reservation> {
  return apiClient.post<Reservation>(`/reservations/${id}/check-out`);
}

export function cancelReservation(id: string, reason?: string): Promise<Reservation> {
  return apiClient.post<Reservation>(`/reservations/${id}/cancel`, { reason });
}

export function noShowReservation(id: string): Promise<Reservation> {
  return apiClient.post<Reservation>(`/reservations/${id}/no-show`);
}
