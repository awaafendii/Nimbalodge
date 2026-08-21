import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as usersService from "../services/users.js";
import type { CreateUserInput } from "../services/users.js";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: usersService.listUsers,
    // Best-effort : alimente le filtre "utilisateur" du journal d'audit (features/audit-logs) en
    // plus de la carte Équipe (features/settings). Un rôle avec audit-logs.view mais sans
    // users.view (cas hypothétique, aucun rôle seedé aujourd'hui) reçoit un 403 ici — l'écran
    // d'audit doit rester utilisable, juste sans ce filtre, jamais planter/re-tenter en boucle.
    retry: false,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersService.createUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useAddHotelMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, hotelId, roleId }: { userId: string; hotelId: string; roleId: string }) =>
      usersService.addHotelMembership(userId, hotelId, roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useRemoveHotelMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, hotelId }: { userId: string; hotelId: string }) =>
      usersService.removeHotelMembership(userId, hotelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
