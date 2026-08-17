import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

// Étape 6 (Offline) — liste blanche des domaines dont les requêtes sont persistées localement
// (IndexedDB, voir apps/web/src/offline/query-persister.ts) pour la consultation hors ligne des
// écrans terrain. Allow-list explicite, jamais un filtre par défaut permissif : Finance (et tout
// le reste, non listé ici) n'est JAMAIS écrit sur disque, quelle que soit l'évolution future du
// reste de l'app — ajouter un domaine à la persistance hors ligne plus tard, c'est ajouter sa clé
// ici, pas modifier la logique de filtrage elle-même.
const OFFLINE_PERSISTED_QUERY_KEYS = ["housekeeping", "maintenance-requests", "maintenance-interventions", "attendances"];

export function isOfflinePersistedQuery(queryKey: readonly unknown[]): boolean {
  const [firstKey] = queryKey;
  return typeof firstKey === "string" && OFFLINE_PERSISTED_QUERY_KEYS.includes(firstKey);
}
