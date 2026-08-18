import { ApiError, apiFetch } from "../services/api-client.js";
import { useAuthStore } from "../stores/auth-store.js";
import { openOfflineDb, type PendingMutation } from "./db.js";

export interface QueueMutationRequest {
  domain: string;
  type: string;
  method: "POST" | "PATCH";
  path: string;
  body?: unknown;
}

export type QueueOrSendResult<T> = { synced: true; data: T } | { synced: false; mutationId: string };

// Étape 6 (Offline) — point d'entrée unique utilisé par les hooks de mutation des domaines pilotes
// à la place d'un appel direct à apiClient. En ligne : comportement identique à aujourd'hui (même
// latence pour le cas courant), avec un en-tête Idempotency-Key systématique — couvre aussi le cas
// "requête reçue par le serveur mais réponse perdue en ligne instable", pas seulement le
// hors-ligne strict (voir apps/api/src/common/interceptors/idempotency.interceptor.ts). Une vraie
// erreur HTTP (validation, permission, conflit métier) n'est JAMAIS mise en file — seul un échec
// réseau pur (ApiError status 0, ou navigator.onLine déjà false) déclenche la mise en attente.
export async function queueOrSend<T>(request: QueueMutationRequest): Promise<QueueOrSendResult<T>> {
  const { user } = useAuthStore.getState();
  if (!user) {
    throw new Error("Utilisateur non authentifié — impossible de mettre une action en file.");
  }

  const mutationId = crypto.randomUUID();

  if (navigator.onLine) {
    try {
      const data = await apiFetch<T>(request.path, {
        method: request.method,
        body: request.body,
        headers: { "Idempotency-Key": mutationId },
      });
      return { synced: true, data };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 0) {
        throw error;
      }
      // Échec réseau pur malgré navigator.onLine=true (connexion instable) — traité comme
      // hors-ligne, tombe dans la mise en file ci-dessous plutôt que de remonter l'erreur.
    }
  }

  const mutation: PendingMutation = {
    id: mutationId,
    userId: user.id,
    hotelId: user.hotel?.id ?? null,
    domain: request.domain,
    type: request.type,
    method: request.method,
    path: request.path,
    body: request.body,
    createdAt: Date.now(),
    status: "pending",
    attempts: 0,
  };
  const db = await openOfflineDb();
  await db.put("pendingMutations", mutation);

  return { synced: false, mutationId };
}

export async function listPendingMutationsForUser(userId: string): Promise<PendingMutation[]> {
  const db = await openOfflineDb();
  const all = await db.getAllFromIndex("pendingMutations", "byUserId", userId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

// Utilisé par le panneau des opérations en attente (Étape 6 incrément 5) — toutes les mutations en
// file, tous utilisateurs confondus (l'appareil peut avoir des mutations d'un utilisateur qui
// n'est plus le compte actif ; le panneau les montre quand même, marquées comme appartenant à
// quelqu'un d'autre, pour la transparence, mais ne les propose jamais au rejeu).
export async function listAllPendingMutations(): Promise<PendingMutation[]> {
  const db = await openOfflineDb();
  const all = await db.getAll("pendingMutations");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateMutation(id: string, patch: Partial<PendingMutation>): Promise<void> {
  const db = await openOfflineDb();
  const existing = await db.get("pendingMutations", id);
  if (!existing) return;
  await db.put("pendingMutations", { ...existing, ...patch });
}

export async function removeMutation(id: string): Promise<void> {
  const db = await openOfflineDb();
  await db.delete("pendingMutations", id);
}
