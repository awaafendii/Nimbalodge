import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type MutationStatus = "pending" | "syncing" | "synced" | "error" | "conflict";

// Étape 6 (Offline) — une entrée par mutation mise en file pendant une période hors ligne (ou un
// échec réseau pur en ligne instable). `id` sert aussi de clé d'idempotence, transmise telle
// quelle au serveur via l'en-tête Idempotency-Key (voir apps/api/src/common/interceptors/
// idempotency.interceptor.ts) — c'est ce qui garantit qu'un rejeu après reconnexion ne s'applique
// jamais deux fois côté serveur. `userId` est ce qui empêche le moteur de synchronisation de
// rejouer les mutations d'un autre utilisateur si quelqu'un d'autre se connecte sur le même
// appareil avant que la file du premier n'ait fini de synchroniser (voir sync-manager.ts).
export interface PendingMutation {
  id: string;
  userId: string;
  hotelId: string | null;
  domain: string;
  type: string;
  method: "POST" | "PATCH";
  path: string;
  body: unknown;
  createdAt: number;
  status: MutationStatus;
  attempts: number;
  lastError?: string;
  lastAttemptAt?: number;
}

interface OfflineDbSchema extends DBSchema {
  pendingMutations: {
    key: string;
    value: PendingMutation;
    indexes: { byUserId: string; byStatus: string };
  };
  // Réservé au persister TanStack Query (query-persister.ts) — un unique blob sous une clé fixe,
  // aucune logique métier dessus. Pas d'object store séparé "cachedReads" fait main : réutilise le
  // mécanisme officiel de persistance de TanStack Query plutôt qu'un cache parallèle à maintenir.
  queryCache: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = "nimbalodge-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDbSchema>> | null = null;

export function openOfflineDb(): Promise<IDBPDatabase<OfflineDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const mutations = db.createObjectStore("pendingMutations", { keyPath: "id" });
        mutations.createIndex("byUserId", "userId");
        mutations.createIndex("byStatus", "status");
        db.createObjectStore("queryCache");
      },
    });
  }
  return dbPromise;
}
