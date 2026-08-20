// Nimba AI (Étape 8) — forme de sortie exacte demandée pour toute anomalie détectée. L'IA ne doit
// jamais présenter une hypothèse comme un fait : `explanation` reste factuelle (ce qui a été
// observé et comparé), jamais une certitude sur la CAUSE (ex. "dépense suspecte" au lieu de
// "fraude probable").
export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface Anomaly {
  severity: AnomalySeverity;
  indicator: string;
  period: { from: string; to: string };
  observedValue: string;
  referenceValue: string;
  explanation: string;
  recommendation?: string;
  resourceType?: string;
  resourceId?: string;
}
