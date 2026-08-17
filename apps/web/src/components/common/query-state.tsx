import type { ReactNode } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@nimbalodge/ui";

import { useOnlineStatus } from "../../hooks/use-online-status.js";
import { ApiError } from "../../services/api-client.js";

// Enveloppe unique pour les 4 états qu'un écran piloté par l'API doit gérer explicitement (voir
// directive produit — zéro donnée / chargement / erreur / absence de permission). L'état "offline"
// est géré globalement (OfflineBanner), pas ici ; l'état "synchronisation" par le spinner du
// Topbar (useIsFetching). Utilisé par tout écran connecté à un hook React Query.
interface QueryStateProps<T> {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
  onRetry?: () => void;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  skeletonRows?: number;
  // Remplace le squelette par défaut (lignes empilées) — utile pour une grille de KPI, par ex.
  renderLoading?: () => ReactNode;
  children: (data: T) => ReactNode;
}

export function QueryState<T>({
  isLoading,
  error,
  data,
  onRetry,
  isEmpty,
  emptyTitle = "Aucune donnée",
  emptyDescription,
  emptyAction,
  skeletonRows = 3,
  renderLoading,
  children,
}: QueryStateProps<T>) {
  const isOnline = useOnlineStatus();

  if (isLoading) {
    if (renderLoading) {
      return <>{renderLoading()}</>;
    }
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    const isForbidden = error instanceof ApiError && error.status === 403;
    // Hors ligne : erreur réseau, pas une erreur serveur — message distinct, jamais affiché si la
    // réponse était un 403 explicite (ça, c'est une décision du serveur, pas un problème réseau).
    const isOffline = !isOnline && !isForbidden;
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">
            {isForbidden ? "Accès non autorisé" : isOffline ? "Hors connexion" : "Erreur de chargement"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {isForbidden
              ? "Vous n'avez pas la permission de consulter ces données."
              : isOffline
                ? "Impossible de charger ces données sans connexion réseau."
                : error instanceof Error
                  ? error.message
                  : "Une erreur inattendue s'est produite."}
          </p>
          {!isForbidden && onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry} className="self-start">
              Réessayer
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (data === undefined) {
    return null;
  }

  if (isEmpty?.(data)) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-[var(--fw-subtitle-strong)] text-sm text-foreground">{emptyTitle}</p>
          {emptyDescription ? <p className="text-sm text-muted-foreground">{emptyDescription}</p> : null}
          {emptyAction}
        </CardContent>
      </Card>
    );
  }

  return <>{children(data)}</>;
}
