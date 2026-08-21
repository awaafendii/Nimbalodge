import { useQuery } from "@tanstack/react-query";

import * as rolesService from "../services/roles.js";

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: rolesService.listRoles,
  });
}

// GET /roles renvoie aussi les rôles plateforme (organizationId: null, ex. SUPER_ADMIN) et
// HOTEL_ADMIN (rôle métier retiré, conservé en base pour l'historique — voir prisma/seed.ts) : ni
// l'un ni l'autre n'est attribuable via POST /users (le backend rejette organizationId: null, voir
// UsersService.create()) — ce filtre reflète exactement cette règle backend côté sélecteur, pas une
// restriction inventée côté frontend.
export function useAssignableRoles() {
  const roles = useRoles();
  return {
    ...roles,
    data: roles.data?.filter((role) => role.organizationId !== null && role.name !== "HOTEL_ADMIN"),
  };
}
