import { RefreshCw } from "lucide-react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  StatusBadge,
} from "@nimbalodge/ui";

import { usePendingMutations, usePendingSyncActions } from "../../hooks/use-pending-sync.js";
import type { PendingMutation } from "../../offline/db.js";
import { triggerSync } from "../../offline/sync-manager.js";
import { useAuthStore } from "../../stores/auth-store.js";

const DOMAIN_LABELS: Record<string, string> = {
  attendances: "Présence",
  housekeeping: "Housekeeping",
  "maintenance-requests": "Demande de maintenance",
  "maintenance-interventions": "Intervention de maintenance",
};

const TYPE_LABELS: Record<string, string> = {
  "clock-in": "Pointage arrivée",
  "clock-out": "Pointage départ",
  "create-task": "Signalement à nettoyer",
  clean: "Nettoyage",
  inspect: "Inspection",
  create: "Création",
  approve: "Approbation",
  reject: "Rejet",
  cancel: "Annulation",
  start: "Démarrage",
  complete: "Fin d'intervention",
};

function describe(mutation: PendingMutation): string {
  const domain = DOMAIN_LABELS[mutation.domain] ?? mutation.domain;
  const type = TYPE_LABELS[mutation.type] ?? mutation.type;
  return `${domain} — ${type}`;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function PendingSyncBadge() {
  const { data: allMutations } = usePendingMutations();
  const userId = useAuthStore((s) => s.user?.id);
  // Un appareil partagé peut porter la file d'un utilisateur précédent qui ne s'est pas
  // reconnecté depuis — jamais mélangée à celle de l'utilisateur actif (voir sync-manager.ts, qui
  // ne rejoue que les mutations de l'utilisateur courant). Le badge ne compte donc que les
  // siennes ; les autres restent visibles dans le panneau, mais uniquement comme un total anonyme.
  const mine = (allMutations ?? []).filter((m) => m.userId === userId);
  const others = (allMutations ?? []).filter((m) => m.userId !== userId);
  const hasIssues = mine.some((m) => m.status === "error" || m.status === "conflict");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Opérations en attente" className="relative">
          <RefreshCw className="size-4" />
          {mine.length > 0 ? (
            <span
              className={`absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-[var(--fw-small-strong)] text-white ${hasIssues ? "bg-critical" : "bg-warning"}`}
            >
              {mine.length > 9 ? "9+" : mine.length}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Opérations en attente</SheetTitle>
          <SheetDescription>
            Actions saisies hors ligne ou en attente de synchronisation avec le serveur.
          </SheetDescription>
        </SheetHeader>
        <PendingSyncList mutations={mine} otherUsersCount={others.length} />
      </SheetContent>
    </Sheet>
  );
}

function PendingSyncList({ mutations, otherUsersCount }: { mutations: PendingMutation[]; otherUsersCount: number }) {
  const { retry, discard } = usePendingSyncActions();

  const otherUsersNotice =
    otherUsersCount > 0 ? (
      <p className="text-xs text-muted-foreground">
        {otherUsersCount} action{otherUsersCount > 1 ? "s" : ""} en attente d'un autre utilisateur sur cet appareil —
        sera synchronisée à sa reconnexion.
      </p>
    ) : null;

  if (mutations.length === 0) {
    return (
      <div className="mt-6 flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Aucune opération en attente — tout est synchronisé.</p>
        {otherUsersNotice}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto">
      {otherUsersNotice}
      {mutations.map((mutation) => (
        <div key={mutation.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-[var(--fw-subtitle-strong)] text-foreground">{describe(mutation)}</p>
              <p className="text-xs text-muted-foreground">{formatTimestamp(mutation.createdAt)}</p>
            </div>
            <StatusBadge status={mutation.status} />
          </div>

          {mutation.lastError ? <p className="text-xs text-critical">{mutation.lastError}</p> : null}

          {mutation.status === "error" || mutation.status === "conflict" ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => retry(mutation.id)}>
                Réessayer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => discard(mutation.id)}>
                Ignorer
              </Button>
            </div>
          ) : null}
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={() => triggerSync()} className="mt-1">
        Synchroniser maintenant
      </Button>
    </div>
  );
}
