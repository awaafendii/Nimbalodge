import * as React from "react";

import { cn } from "../lib/utils.js";

// Généralise la grille responsive déjà utilisée en dur sur /dashboard
// ("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4") pour qu'elle devienne le conteneur
// standard du bandeau KPI de chaque écran de module, sans dupliquer ces classes partout.
export interface KpiGridProps {
  children: React.ReactNode;
  /** Nombre de colonnes en grand écran (xl). Les paliers sm/md restent fixes (1 puis 2). */
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const XL_COLS = {
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
} as const;

export function KpiGrid({ children, columns = 4, className }: KpiGridProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", XL_COLS[columns], className)}>{children}</div>
  );
}
