import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as reservationsService from "../services/reservations.js";
import type { CreateReservationInput } from "../services/reservations.js";

const RESERVATIONS_KEY = ["reservations"] as const;

export function useReservations() {
  return useQuery({
    queryKey: RESERVATIONS_KEY,
    queryFn: reservationsService.listReservations,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReservationInput) => reservationsService.createReservation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RESERVATIONS_KEY }),
  });
}

// Une seule mutation générique pour toutes les transitions de statut (confirm/check-in/check-out/
// no-show/cancel) — même liste d'invalidation, seule la fonction d'appel change par action.
function useReservationTransition(
  action: (id: string, reason?: string) => Promise<reservationsService.Reservation>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => action(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RESERVATIONS_KEY }),
  });
}

export function useConfirmReservation() {
  return useReservationTransition((id) => reservationsService.confirmReservation(id));
}

export function useCheckInReservation() {
  return useReservationTransition((id) => reservationsService.checkInReservation(id));
}

export function useCheckOutReservation() {
  return useReservationTransition((id) => reservationsService.checkOutReservation(id));
}

export function useCancelReservation() {
  return useReservationTransition((id, reason) => reservationsService.cancelReservation(id, reason));
}

export function useNoShowReservation() {
  return useReservationTransition((id) => reservationsService.noShowReservation(id));
}
