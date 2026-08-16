import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as hotelsService from "../services/hotels.js";
import { useAuthStore } from "../stores/auth-store.js";

export function useHotels() {
  return useQuery({
    queryKey: ["hotels"],
    queryFn: hotelsService.listHotels,
  });
}

export function useCreateHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hotelsService.createHotel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotels"] }),
  });
}

// null si le demandeur est org-wide (aucun hôtel unique — voir user.hotel dans GET /auth/me).
export function useCurrentHotel() {
  const hotelId = useAuthStore((s) => s.user?.hotel?.id ?? null);
  return useQuery({
    queryKey: ["hotels", hotelId],
    queryFn: () => hotelsService.getHotel(hotelId!),
    enabled: Boolean(hotelId),
  });
}
