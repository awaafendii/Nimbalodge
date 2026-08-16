import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as guestsService from "../services/guests.js";
import type { CreateGuestInput, UpdateGuestInput } from "../services/guests.js";

const GUESTS_KEY = ["guests"] as const;

export function useGuests() {
  return useQuery({
    queryKey: GUESTS_KEY,
    queryFn: guestsService.listGuests,
  });
}

export function useCreateGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGuestInput) => guestsService.createGuest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GUESTS_KEY }),
  });
}

export function useUpdateGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGuestInput }) => guestsService.updateGuest(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GUESTS_KEY }),
  });
}
