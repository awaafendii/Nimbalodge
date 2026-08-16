import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as roomTypesService from "../services/room-types.js";
import type { CreateRoomTypeInput, UpdateRoomTypeInput } from "../services/room-types.js";

const ROOM_TYPES_KEY = ["room-types"] as const;

export function useRoomTypes() {
  return useQuery({
    queryKey: ROOM_TYPES_KEY,
    queryFn: roomTypesService.listRoomTypes,
  });
}

export function useCreateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomTypeInput) => roomTypesService.createRoomType(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOM_TYPES_KEY }),
  });
}

export function useUpdateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoomTypeInput }) =>
      roomTypesService.updateRoomType(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOM_TYPES_KEY }),
  });
}
