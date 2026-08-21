import * as React from "react";

import { cn } from "../lib/utils.js";

// Extrait du chip delta de KpiCard (rendu identique) pour être réutilisable hors d'un KpiCard —
// ex. dans un ModuleAlertBanner ou à côté d'une légende de graphique. `sentiment` reste explicite
// (jamais déduit du signe de `value`) : une dépense en hausse est un mauvais signal, une recette en
// hausse un bon signal — seul l'appelant, qui connaît le domaine métier, sait lequel s'applique.
export interface TrendIndicatorProps {
  value: number;
  sentiment: "up" | "down";
  className?: string;
}

export function TrendIndicator({ value, sentiment, className }: TrendIndicatorProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-[3px] text-[11.3px] font-[var(--fw-small-strong)]",
        sentiment === "up" ? "text-good" : "text-critical",
        className
      )}
    >
      {value >= 0 ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  );
}
