import { useOnlineStatus } from "../../hooks/use-online-status.js";

// État "offline" (directive produit) — bannière globale, pas par module : la connectivité est une
// propriété de l'appareil, pas d'un écran en particulier.
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) {
    return null;
  }
  return (
    <div className="bg-destructive px-4 py-1.5 text-center text-xs font-[var(--fw-subtitle-strong)] text-destructive-foreground">
      Hors connexion — les données affichées peuvent ne pas être à jour.
    </div>
  );
}
