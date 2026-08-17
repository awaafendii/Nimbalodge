import { registerSW } from "virtual:pwa-register";

export interface ServiceWorkerCallbacks {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;

// Enregistre le service worker généré par vite-plugin-pwa (registerType: "prompt", voir
// vite.config.ts) — n'active jamais silencieusement une nouvelle version : applyServiceWorkerUpdate()
// doit être appelé explicitement suite à une confirmation utilisateur (voir UpdatePrompt, Étape 6
// incrément 2), jamais automatiquement au chargement.
export function registerServiceWorker(callbacks: ServiceWorkerCallbacks = {}): void {
  if (!("serviceWorker" in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh: callbacks.onNeedRefresh,
    onOfflineReady: callbacks.onOfflineReady,
  });
}

export function applyServiceWorkerUpdate(): void {
  void applyUpdate?.(true);
}
