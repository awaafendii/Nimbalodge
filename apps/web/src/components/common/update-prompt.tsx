import { useEffect, useState } from "react";

import { applyServiceWorkerUpdate, registerServiceWorker } from "../../pwa/register-sw.js";

// Bannière de mise à jour du service worker — même emplacement/forme qu'OfflineBanner, juste au-
// dessus. registerType est "prompt" (voir vite.config.ts) : une nouvelle version ne prend jamais le
// contrôle silencieusement, l'utilisateur doit cliquer "Recharger" — un rechargement imposé en
// pleine saisie financière serait une perte de données inacceptable pour un ERP réel.
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    registerServiceWorker({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    });
  }, []);

  // Confirmation ponctuelle (première installation du SW), pas un état permanent comme
  // OfflineBanner — se referme seule.
  useEffect(() => {
    if (!offlineReady) return;
    const timeout = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(timeout);
  }, [offlineReady]);

  if (needRefresh) {
    return (
      <div className="flex items-center justify-center gap-3 bg-primary px-4 py-1.5 text-center text-xs font-[var(--fw-subtitle-strong)] text-primary-foreground">
        <span>Nouvelle version de NimbaLodge disponible.</span>
        <button type="button" className="underline underline-offset-2" onClick={applyServiceWorkerUpdate}>
          Recharger
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="bg-primary px-4 py-1.5 text-center text-xs font-[var(--fw-subtitle-strong)] text-primary-foreground">
        NimbaLodge est prêt à fonctionner hors connexion.
      </div>
    );
  }

  return null;
}
