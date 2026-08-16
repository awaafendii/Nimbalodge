import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as roomsService from "../services/rooms.js";
import type { CreateRoomInput, UpdateRoomInput } from "../services/rooms.js";

const ROOMS_KEY = ["rooms"] as const;

export function useRooms() {
  return useQuery({
    queryKey: ROOMS_KEY,
    queryFn: roomsService.listRooms,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) => roomsService.createRoom(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOMS_KEY }),
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoomInput }) => roomsService.updateRoom(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOMS_KEY }),
  });
}

// N'interroge le backend qu'une fois les deux dates renseignées — évite un appel avec des query
// params invalides (checkIn/checkOut requis côté DTO).
export function useAvailableRooms(checkIn: string, checkOut: string) {
  return useQuery({
    queryKey: ["rooms", "available", checkIn, checkOut],
    queryFn: () => roomsService.listAvailableRooms(checkIn, checkOut),
    enabled: Boolean(checkIn && checkOut),
  });
}
