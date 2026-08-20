import { useState } from "react";
import { cn } from "@nimbalodge/ui";

import AnomaliesPage from "./anomalies.js";
import ChatPage from "./chat.js";
import InsightsPage from "./insights.js";

type NimbaAiTab = "insights" | "anomalies" | "assistant";

const TABS: { id: NimbaAiTab; label: string }[] = [
  { id: "insights", label: "Insights" },
  { id: "anomalies", label: "Anomalies" },
  { id: "assistant", label: "Assistant" },
];

// Nimba AI. Trois onglets réels (Insights — Étape 7, Anomalies — Étape 8, Assistant — Étape 9) —
// jamais un onglet vide ou "à venir" (voir la suppression du composant ComingSoon, Étape 7
// Production Readiness Priority 9 : pas de scaffold mort dans ce dépôt).
export default function NimbaAiPage() {
  const [tab, setTab] = useState<NimbaAiTab>("insights");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 border-b border-border">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={cn(
              "px-3 py-2 text-sm font-[var(--fw-small-strong)] transition-colors",
              tab === entry.id ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {tab === "insights" ? <InsightsPage /> : tab === "anomalies" ? <AnomaliesPage /> : <ChatPage />}
    </div>
  );
}
