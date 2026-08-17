import type { PersistedClient, Persister } from "@tanstack/query-persist-client-core";

import { openOfflineDb } from "./db.js";

const CACHE_KEY = "tanstack-query-cache";

// Persister minimal pour TanStack Query, écrit à la main par-dessus le store `queryCache` d'idb —
// évite une dépendance supplémentaire (@tanstack/query-async-storage-persister + idb-keyval) pour
// un besoin aussi simple qu'un blob unique lu/écrit en entier (le comportement standard de
// persistQueryClient, quel que soit le stockage sous-jacent) : un seul point d'accès IndexedDB
// dans tout le projet (voir db.ts).
export const offlineQueryPersister: Persister = {
  async persistClient(persistedClient) {
    const db = await openOfflineDb();
    await db.put("queryCache", persistedClient, CACHE_KEY);
  },
  async restoreClient() {
    const db = await openOfflineDb();
    return (await db.get("queryCache", CACHE_KEY)) as PersistedClient | undefined;
  },
  async removeClient() {
    const db = await openOfflineDb();
    await db.delete("queryCache", CACHE_KEY);
  },
};
