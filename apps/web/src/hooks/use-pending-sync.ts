import { useQuery, useQueryClient } from "@tanstack/react-query";

import { listAllPendingMutations, removeMutation, updateMutation } from "../offline/mutation-queue.js";
import { triggerSync } from "../offline/sync-manager.js";

export const PENDING_MUTATIONS_KEY = ["offline", "pending-mutations"] as const;

// Étape 6 (Offline) — pas de pub/sub dédié sur pendingMutations (IndexedDB) : on s'appuie sur le
// polling TanStack Query, déjà l'infrastructure réactive de toute l'app. networkMode "always" —
// cette requête lit IndexedDB en local, elle doit fonctionner identiquement en ligne et hors ligne.
export function usePendingMutations() {
  return useQuery({
    queryKey: PENDING_MUTATIONS_KEY,
    queryFn: listAllPendingMutations,
    refetchInterval: 3000,
    networkMode: "always",
  });
}

export function usePendingSyncActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: PENDING_MUTATIONS_KEY });

  return {
    // Remet l'entrée en file active (reset du compteur de tentatives) puis déclenche une passe de
    // synchronisation — utilisé aussi bien pour un échec transitoire ("error") que pour rejouer
    // volontairement un conflit après que l'utilisateur a vérifié que la situation a changé.
    retry: async (id: string) => {
      await updateMutation(id, { status: "pending", attempts: 0, lastError: undefined });
      triggerSync();
      await refresh();
    },
    // Résolution explicite d'un conflit par l'utilisateur : abandonne l'action en attente sans la
    // rejouer. Jamais déclenché automatiquement par le moteur de synchronisation lui-même.
    discard: async (id: string) => {
      await removeMutation(id);
      await refresh();
    },
  };
}
