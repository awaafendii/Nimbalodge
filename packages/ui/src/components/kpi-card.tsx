import * as React from "react";

import { cn } from "../lib/utils.js";

// Port de nimbalodge-app/src/components/ui/Kpi.jsx (+ .kpi* dans components.css) vers Tailwind.
// Pas d'équivalent shadcn — composé à la main sur les tokens de marque.

const ICON_TONE = {
  default: "bg-brand-accent-soft text-brand-accent-ink",
  good: "bg-good-soft text-good",
  gold: "bg-brand-gold-soft text-brand-gold",
  crit: "bg-critical-soft text-critical",
} as const;

export interface KpiCardProps {
  icon?: React.ReactNode;
  iconTone?: keyof typeof ICON_TONE;
  label: string;
  value: React.ReactNode;
  delta?: { value: number; sentiment: "up" | "down" };
  note?: React.ReactNode;
  className?: string;
}

export function KpiCard({ icon, iconTone = "default", label, value, delta, note, className }: KpiCardProps) {
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-xl border border-border bg-card p-[17px_19px] shadow-sm", className)}>
      <div className="flex items-center justify-between">
        {icon ? (
          <span className={cn("flex size-[30px] flex-none items-center justify-center rounded-lg [&_svg]:size-[15px]", ICON_TONE[iconTone])}>
            {icon}
          </span>
        ) : (
          <span />
        )}
        {delta ? (
          <span
            className={cn(
              "flex items-center gap-[3px] text-[11.3px] font-[var(--fw-small-strong)]",
              delta.sentiment === "up" ? "text-good" : "text-critical"
            )}
          >
            {delta.value >= 0 ? "▲" : "▼"} {Math.abs(delta.value)}%
          </span>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-title text-[23px] font-[var(--fw-title-strong)] tabular-nums tracking-[0.1px]">{value}</div>
      {note ? <div className="-mt-1 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );
}
