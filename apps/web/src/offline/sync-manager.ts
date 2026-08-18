import { queryClient } from "../app/query-client.js";
import { ApiError, apiFetch } from "../services/api-client.js";
import { useAuthStore } from "../stores/auth-store.js";
import type { PendingMutation } from "./db.js";
import { listPendingMutationsForUser, removeMutation, updateMutation } from "./mutation-queue.js";

const MAX_ATTEMPTS = 5;
const PERIODIC_CHECK_MS = 30_000;

let syncing = false;

// Étape 6 (Offline) — rejoue les mutations en file, séquentiellement (jamais en parallèle : ordre
// logique — ex. ne pas inspecter une tâche avant de l'avoir nettoyée — et respect du taux global
// de l'API, 100 req/60s, voir apps/api/src/app.module.ts). Ne traite QUE les mutations de
// l'utilisateur actuellement authentifié : si un autre utilisateur se connecte sur le même
// appareil avant que la file du premier n'ait synchronisé, ses mutations restent intouchées,
// invisibles, jusqu'à ce qu'il se reconnecte ici (voir listPendingMutationsForUser).
export async function runSync(): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    let user = useAuthStore.getState().user;
    if (!user) return;

    const pending = (await listPendingMutationsForUser(user.id)).filter(
      (m) => (m.status === "pending" || m.status === "error") && m.attempts < MAX_ATTEMPTS
    );

    for (const mutation of pending) {
      if (!navigator.onLine) break; // réseau reperdu en cours de salve

      // Un seul rafraîchissement de session peut invalider `user` (déconnexion déclenchée par
      // apiFetch si le refresh token lui-même a expiré, voir services/api-client.ts) — revérifié à
      // chaque itération plutôt qu'une seule fois avant la boucle.
      user = useAuthStore.getState().user;
      if (!user) break;

      const shouldStop = await syncOne(mutation);
      if (shouldStop) break;
    }
  } finally {
    syncing = false;
  }
}

// Retourne `true` si la boucle appelante doit s'arrêter (session expirée — inutile de tenter les
// mutations suivantes, elles échoueraient toutes de la même façon).
async function syncOne(mutation: PendingMutation): Promise<boolean> {
  await updateMutation(mutation.id, { status: "syncing", lastAttemptAt: Date.now() });

  try {
    await apiFetch(mutation.path, {
      method: mutation.method,
      body: mutation.body,
      headers: { "Idempotency-Key": mutation.id },
    });
    await removeMutation(mutation.id);
    await queryClient.invalidateQueries({ queryKey: [mutation.domain] });
    return false;
  } catch (error) {
    if (!(error instanceof ApiError)) {
      await updateMutation(mutation.id, {
        status: "error",
        attempts: mutation.attempts + 1,
        lastError: error instanceof Error ? error.message : "Erreur inconnue",
      });
      return false;
    }

    if (error.status === 0) {
      // Réseau reperdu en plein rejeu — reste "pending" (pas d'incrément de tentative, ce n'est
      // pas un échec imputable à la mutation elle-même), retenté au prochain déclenchement.
      await updateMutation(mutation.id, { status: "pending" });
      return true; // inutile de continuer la salve, le réseau vient de tomber
    }

    if (error.status === 401) {
      // apiFetch a déjà tenté un rafraîchissement de session en interne (voir api-client.ts) —
      // s'il échoue toujours ici, le refresh token lui-même a expiré (ex. plusieurs jours hors
      // ligne). apiFetch/refreshAccessToken a alors déjà appelé clearAuth() ; on remet juste cette
      // mutation en attente (pas un échec qui lui est propre) et on arrête la salve entière.
      await updateMutation(mutation.id, { status: "pending" });
      return true;
    }

    if (error.status === 400 || error.status === 409) {
      // Aucune clé d'idempotence connue pour cette mutation (sinon la réponse mise en cache aurait
      // été renvoyée sans erreur) et le serveur la rejette quand même : conflit métier réel —
      // quelqu'un/quelque chose d'autre a changé l'état pendant que la mutation était en file
      // (housekeeping/maintenance : garde de transition ; attendance : pointage déjà ouvert/fermé).
      // Simplification assumée pour ce pilote : tout 400/409 sur un rejeu est traité comme un
      // conflit, pas comme une erreur de validation distincte — les payloads mis en file ont déjà
      // été validés une fois côté client au moment de l'action initiale. Jamais de retry
      // automatique ni de résolution silencieuse.
      await updateMutation(mutation.id, {
        status: "conflict",
        attempts: mutation.attempts + 1,
        lastError: error.message,
      });
      return false;
    }

    // 403 (scope hôtel/département/permission ayant changé entretemps) et tout le reste : erreur
    // générique, visible dans le panneau des opérations en attente, retentable manuellement.
    await updateMutation(mutation.id, {
      status: "error",
      attempts: mutation.attempts + 1,
      lastError: error.message,
    });
    return false;
  }
}

let initialized = false;

export function initSyncManager(): void {
  if (initialized) return;
  initialized = true;
  window.addEventListener("online", () => void runSync());
  setInterval(() => void runSync(), PERIODIC_CHECK_MS);
  void runSync(); // reprend une file laissée en attente d'une session précédente sur cet appareil
}

export function triggerSync(): void {
  void runSync();
}
