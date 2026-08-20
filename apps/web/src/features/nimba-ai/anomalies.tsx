import { Badge, Card, CardContent, CardHeader, CardTitle, Icons, type BadgeProps } from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useAnomalies } from "../../hooks/use-nimba-ai.js";
import type { Anomaly, AnomalySeverity, Provenance } from "../../services/nimba-ai.js";

// Nimba AI (Étape 8 — Détection d'anomalies). Un seul appel (GET /nimba-ai/anomalies) couvre tous
// les détecteurs auxquels le demandeur a accès (voir anomaly-detection.tool.ts, requiredPermissions
// volontairement vide au niveau du Tool) : un demandeur sans aucune permission couverte reçoit
// simplement un tableau vide (jamais un 403), donc "Aucune anomalie détectée" ne distingue pas ici
// "tout va bien" de "vous n'avez accès à aucun domaine surveillé" — cohérent avec le principe du
// brief (l'IA ne doit jamais présenter une hypothèse comme un fait, y compris sur ce qu'elle n'a
// pas pu vérifier).
const SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  low: "Faible",
  medium: "Modérée",
  high: "Élevée",
  critical: "Critique",
};

const SEVERITY_VARIANTS: Record<AnomalySeverity, BadgeProps["variant"]> = {
  low: "neutral",
  medium: "warning",
  high: "critical",
  critical: "critical",
};

const SEVERITY_ORDER: Record<AnomalySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

export default function AnomaliesPage() {
  const anomalies = useAnomalies();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomalies détectées</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QueryState
          isLoading={anomalies.isLoading}
          error={anomalies.error}
          data={anomalies.data}
          onRetry={() => anomalies.refetch()}
          isEmpty={(envelope) => envelope.data.anomalies.length === 0}
          emptyTitle="Aucune anomalie détectée"
          emptyDescription="Sur la base des règles et seuils déterministes disponibles pour vos permissions, aucun écart significatif n'a été relevé sur cette période."
        >
          {(envelope) => {
            const sorted = [...envelope.data.anomalies].sort(
              (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
            );
            return (
              <>
                <p className="text-xs text-muted-foreground">
                  Période du {formatDate(envelope.data.period.from)} au {formatDate(envelope.data.period.to)} — {sorted.length} anomalie
                  {sorted.length > 1 ? "s" : ""}.
                </p>
                <div className="flex flex-col gap-3">
                  {sorted.map((anomaly, index) => (
                    <AnomalyCard key={`${anomaly.resourceType ?? ""}-${anomaly.resourceId ?? index}`} anomaly={anomaly} />
                  ))}
                </div>
                <ProvenanceNote provenance={envelope.provenance} />
              </>
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

// Même affichage que les sections Insights (voir insights.tsx) — la détection d'anomalies est
// elle aussi une donnée calculée par le backend, jamais par le LLM ; sa provenance doit être aussi
// systématiquement visible que pour un Insight (voir le plan d'architecture Nimba AI, "Sources /
// provenance").
function ProvenanceNote({ provenance }: { provenance: Provenance[] }) {
  if (provenance.length === 0) return null;
  return <p className="text-xs text-muted-foreground">Source : {provenance.map((p) => p.module).join(", ")}</p>;
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icons.IconWarn className="size-4 text-muted-foreground" />
          <span className="font-[var(--fw-subtitle-strong)] text-sm text-foreground">{anomaly.indicator}</span>
        </div>
        <Badge variant={SEVERITY_VARIANTS[anomaly.severity]}>{SEVERITY_LABELS[anomaly.severity]}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{anomaly.explanation}</p>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Observé : {anomaly.observedValue}</span>
        <span>Référence : {anomaly.referenceValue}</span>
        <span>
          Période : {formatDate(anomaly.period.from)} — {formatDate(anomaly.period.to)}
        </span>
      </div>
      {anomaly.recommendation ? (
        <p className="text-xs text-foreground">
          <span className="font-[var(--fw-small-strong)]">Recommandation :</span> {anomaly.recommendation}
        </p>
      ) : null}
    </div>
  );
}
