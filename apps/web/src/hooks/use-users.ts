import { useQuery } from "@tanstack/react-query";

import * as usersService from "../services/users.js";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: usersService.listUsers,
    // Best-effort : alimente uniquement le filtre "utilisateur" du journal d'audit (voir
    // features/audit-logs). Un rôle avec audit-logs.view mais sans users.view (cas hypothétique,
    // aucun rôle seedé aujourd'hui) reçoit un 403 ici — l'écran doit rester utilisable, juste sans
    // ce filtre, jamais planter toute la page pour une liste annexe.
    retry: false,
  });
}
