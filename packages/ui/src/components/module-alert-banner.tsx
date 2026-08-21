import * as React from "react";

import { cn } from "../lib/utils.js";

// Bandeau d'alertes métier (ex. dépassement budgétaire, rupture de stock, intervention en retard)
// posé sous le KpiGrid de chaque écran de module. Rendu neutre (rien) si `alerts` est vide — un
// module sans alerte active ne doit jamais afficher un encart creux. Tons alignés sur ceux de
// Badge (success/warning/critical/neutral) pour rester cohérent avec le reste du design system.
export interface ModuleAlert {
  id: string;
  tone: "warning" | "critical" | "success" | "neutral";
  message: React.ReactNode;
  action?: React.ReactNode;
}

export interface ModuleAlertBannerProps {
  alerts: ModuleAlert[];
  className?: string;
}

const TONE_STYLES: Record<ModuleAlert["tone"], string> = {
  warning: "border-warning/30 bg-warning-soft text-warning",
  critical: "border-critical/30 bg-critical-soft text-critical",
  success: "border-good/30 bg-good-soft text-good",
  neutral: "border-border bg-secondary text-muted-foreground",
};

export function ModuleAlertBanner({ alerts, className }: ModuleAlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)} role="status">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm",
            TONE_STYLES[alert.tone]
          )}
        >
          <span className="flex-1">{alert.message}</span>
          {alert.action}
        </div>
      ))}
    </div>
  );
}
