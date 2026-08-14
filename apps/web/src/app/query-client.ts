import { QueryClient } from "@tanstack/react-query";

// Plomberie seule en Phase 1 — aucune query réelle tant qu'apps/api n'existe pas (Phase 2+).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});
