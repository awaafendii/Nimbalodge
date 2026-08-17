import { defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { TooltipProvider } from "@nimbalodge/ui";

import { isOfflinePersistedQuery, queryClient } from "./query-client.js";
import { offlineQueryPersister } from "../offline/query-persister.js";
import { ThemeProvider } from "../theme/theme-provider.js";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: offlineQueryPersister,
        // Étape 6 (Offline) — n'écrit sur disque QUE les domaines terrain listés dans
        // isOfflinePersistedQuery (voir query-client.ts) ; combine avec le filtre par défaut de
        // TanStack (jamais une requête en erreur/pending) plutôt que de le remplacer.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) && isOfflinePersistedQuery(query.queryKey),
        },
      }}
    >
      <ThemeProvider>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </ThemeProvider>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </PersistQueryClientProvider>
  );
}
