import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-[var(--fw-small-strong)] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-good-soft text-good",
        warning: "border-transparent bg-warning-soft text-warning",
        critical: "border-transparent bg-critical-soft text-critical",
        neutral: "border-transparent bg-secondary text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };

// --- StatusBadge : port du comportement de docs/legacy/nimbalodge-app/src/components/ui/Chip.jsx ---
// Mappe un statut métier (paid/pending/late/good/warn/crit/vacant/neutral) vers un libellé FR et
// une variante de couleur, pour rester compatible avec le vocabulaire de statut déjà utilisé dans
// le prototype (factures, appartements, locataires) au moment de rebrancher ces pages.

const STATUS_LABELS: Record<string, string> = {
  good: "À jour",
  warn: "À surveiller",
  crit: "En retard",
  vacant: "Vacant",
  neutral: "—",
  paid: "Payée",
  pending: "En attente",
  late: "En retard",
  // ReservationStatus (Phase 7) — clés en MAJUSCULES car alignées telles quelles sur l'enum
  // backend (Prisma `ReservationStatus`), contrairement au vocabulaire minuscule ci-dessus hérité
  // du prototype legacy. Réutilisable partout où un statut de réservation s'affiche (Réservations,
  // futur Tableau de bord/Housekeeping) sans réécrire ce mapping à chaque écran.
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  CHECKED_IN: "En séjour",
  CHECKED_OUT: "Terminée",
  CANCELLED: "Annulée",
  NO_SHOW: "No-show",
  // LeaveStatus (Phase 8) — PENDING/CANCELLED réutilisent les clés ci-dessus (même sémantique).
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
  // PayslipStatus (Phase 8)
  DRAFT: "Brouillon",
  FINALIZED: "Finalisé",
  PAID: "Payé",
  // PurchaseOrderStatus (Phase 9) — DRAFT/CANCELLED déjà présents ci-dessus (même sémantique).
  SENT: "Envoyée",
  PARTIALLY_RECEIVED: "Partiellement reçue",
  RECEIVED: "Reçue",
  // Statut chambre calculé (Phase 10, HousekeepingTasksService.dashboard()) — pas l'enum Prisma
  // brut (HousekeepingStatus n'a pas AVAILABLE, dérivé côté service quand INSPECTED ou aucune
  // tâche active).
  AVAILABLE: "Disponible",
  TO_CLEAN: "À nettoyer",
  CLEANED: "Nettoyée",
  INSPECTED: "Inspectée",
  // MaintenanceInterventionStatus (Phase 10) — CANCELLED déjà présent ci-dessus.
  SCHEDULED: "Planifiée",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
};

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
  paid: "success",
  pending: "warning",
  late: "critical",
  good: "success",
  warn: "warning",
  crit: "critical",
  vacant: "neutral",
  neutral: "neutral",
  PENDING: "warning",
  CONFIRMED: "default",
  CHECKED_IN: "success",
  CHECKED_OUT: "neutral",
  CANCELLED: "critical",
  NO_SHOW: "critical",
  APPROVED: "success",
  REJECTED: "critical",
  DRAFT: "neutral",
  FINALIZED: "warning",
  PAID: "success",
  SENT: "default",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  AVAILABLE: "success",
  TO_CLEAN: "critical",
  CLEANED: "warning",
  INSPECTED: "success",
  SCHEDULED: "default",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: string;
}

export function StatusBadge({ status, children, ...props }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[status] ?? "neutral";
  return (
    <Badge variant={variant} {...props}>
      {children ?? STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
