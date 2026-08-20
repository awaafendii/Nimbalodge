import { fmtGNF } from "@nimbalodge/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Icons,
  KpiCard,
  type DataTableColumn,
} from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import {
  useDepartmentInsights,
  useFinanceInsights,
  useHospitalityInsights,
  useHrPayrollInsights,
  useHrWorkforceInsights,
} from "../../hooks/use-nimba-ai.js";
import type { DepartmentComparisonRow, Provenance } from "../../services/nimba-ai.js";

// Nimba AI (Étape 7 — Système d'Insights). Chaque section correspond exactement à un Tool backend
// et sa propre permission (voir apps/api/src/modules/nimba-ai) : un utilisateur sans payslips.view
// voit les 4 autres sections normalement et "Accès non autorisé" seulement sur la masse salariale
// (QueryState le gère déjà nativement, aucun code spécifique nécessaire ici). Aucune section
// n'affiche jamais de commentaire généré par IA dans cette étape (arrive avec le fournisseur LLM
// branché à l'Assistant, Étape 9) — uniquement des données déjà calculées par le backend, toujours
// accompagnées de leur provenance.
export default function InsightsPage() {
  return (
    <div className="flex flex-col gap-5">
      <FinanceInsightsSection />
      <DepartmentInsightsSection />
      <HospitalityInsightsSection />
      <HrWorkforceInsightsSection />
      <HrPayrollInsightsSection />
    </div>
  );
}

function ProvenanceNote({ provenance }: { provenance: Provenance[] }) {
  if (provenance.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Source : {provenance.map((p) => p.module).join(", ")}
      {provenance[0]?.period ? ` — période du ${formatDate(provenance[0].period.from)} au ${formatDate(provenance[0].period.to)}` : ""}
    </p>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

function deltaFromPercent(current: number | null, previous: number | null): { value: number; sentiment: "up" | "down" } | undefined {
  if (current === null || previous === null) return undefined;
  const diff = Math.round((current - previous) * 10) / 10;
  return { value: diff, sentiment: diff >= 0 ? "up" : "down" };
}

function FinanceInsightsSection() {
  const insights = useFinanceInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finance — résumé du mois</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QueryState isLoading={insights.isLoading} error={insights.error} data={insights.data} onRetry={() => insights.refetch()}>
          {(envelope) => (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard icon={<Icons.IconWallet />} iconTone="good" label="Recettes" value={fmtGNF(Number(envelope.data.totalRevenue))} />
                <KpiCard icon={<Icons.IconWallet />} iconTone="crit" label="Dépenses" value={fmtGNF(Number(envelope.data.totalExpense))} />
                <KpiCard icon={<Icons.IconWallet />} label="Solde caisse" value={fmtGNF(Number(envelope.data.cashBalance))} />
                <KpiCard icon={<Icons.IconWallet />} label="Solde banque" value={fmtGNF(Number(envelope.data.bankBalance))} />
              </div>
              <ProvenanceNote provenance={envelope.provenance} />
            </>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function DepartmentInsightsSection() {
  const insights = useDepartmentInsights();

  const columns: DataTableColumn<DepartmentComparisonRow>[] = [
    { id: "label", header: "Département", cell: (row) => row.label },
    { id: "revenue", header: "Recettes", align: "right", cell: (row) => fmtGNF(Number(row.totalRevenue)) },
    { id: "expense", header: "Dépenses", align: "right", cell: (row) => fmtGNF(Number(row.totalExpense)) },
    { id: "net", header: "Net", align: "right", cell: (row) => fmtGNF(Number(row.net)) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparaison par département</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QueryState
          isLoading={insights.isLoading}
          error={insights.error}
          data={insights.data}
          onRetry={() => insights.refetch()}
          isEmpty={(envelope) => envelope.data.rows.length === 0}
          emptyTitle="Aucune donnée par département"
          emptyDescription="Aucune recette ni dépense rattachée à un département sur cette période."
        >
          {(envelope) => (
            <>
              <DataTable columns={columns} data={envelope.data.rows} getRowId={(row) => row.departmentId} />
              <ProvenanceNote provenance={envelope.provenance} />
            </>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function HospitalityInsightsSection() {
  const insights = useHospitalityInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hôtellerie — occupation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QueryState isLoading={insights.isLoading} error={insights.error} data={insights.data} onRetry={() => insights.refetch()}>
          {(envelope) => {
            const { current, previous } = envelope.data;
            return (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <KpiCard
                    icon={<Icons.IconBed />}
                    label="Taux d'occupation"
                    value={current.occupancyRatePercent === null ? "Données insuffisantes" : `${current.occupancyRatePercent}%`}
                    delta={deltaFromPercent(current.occupancyRatePercent, previous.occupancyRatePercent)}
                    note={`${current.occupiedRoomNights} / ${current.availableRoomNights} nuits-chambre`}
                  />
                  <KpiCard icon={<Icons.IconWallet />} label="ADR (tarif moyen/nuit)" value={current.adr === null ? "—" : fmtGNF(Number(current.adr))} />
                  <KpiCard icon={<Icons.IconTrend />} label="RevPAR" value={current.revpar === null ? "—" : fmtGNF(Number(current.revpar))} />
                </div>
                {Object.keys(envelope.data.reservationsByStatus).length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {Object.entries(envelope.data.reservationsByStatus).map(([status, count]) => (
                      <span key={status} className="rounded-full border border-border px-2 py-0.5">
                        {status} : {count}
                      </span>
                    ))}
                  </div>
                ) : null}
                <ProvenanceNote provenance={envelope.provenance} />
              </>
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function HrWorkforceInsightsSection() {
  const insights = useHrWorkforceInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle>RH — effectifs & présence</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QueryState isLoading={insights.isLoading} error={insights.error} data={insights.data} onRetry={() => insights.refetch()}>
          {(envelope) => (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <KpiCard icon={<Icons.IconUsers />} label="Effectif actif" value={envelope.data.headcount} />
                <KpiCard
                  icon={<Icons.IconWarn />}
                  iconTone={envelope.data.absenteeismRatePercent && envelope.data.absenteeismRatePercent > 10 ? "crit" : "default"}
                  label="Taux d'absentéisme"
                  value={envelope.data.absenteeismRatePercent === null ? "Données insuffisantes" : `${envelope.data.absenteeismRatePercent}%`}
                  note={`${envelope.data.attendedShifts} / ${envelope.data.scheduledShifts} postes honorés`}
                />
                <KpiCard
                  icon={<Icons.IconLeaf />}
                  label="Demandes de congé"
                  value={Object.values(envelope.data.leaveRequestsByStatus).reduce((sum, n) => sum + n, 0)}
                />
              </div>
              <ProvenanceNote provenance={envelope.provenance} />
            </>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function HrPayrollInsightsSection() {
  const insights = useHrPayrollInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle>RH — masse salariale</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QueryState isLoading={insights.isLoading} error={insights.error} data={insights.data} onRetry={() => insights.refetch()}>
          {(envelope) => {
            const { current, previous } = envelope.data;
            const currentAmount = Number(current.totalNetPay);
            const previousAmount = Number(previous.totalNetPay);
            const deltaPercent =
              previousAmount > 0 ? Math.round(((currentAmount - previousAmount) / previousAmount) * 1000) / 10 : undefined;
            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <KpiCard
                  icon={<Icons.IconWallet />}
                  label={`Masse salariale — ${current.month}/${current.year}`}
                  value={fmtGNF(currentAmount)}
                  delta={deltaPercent !== undefined ? { value: deltaPercent, sentiment: deltaPercent >= 0 ? "up" : "down" } : undefined}
                  note={`${current.payslipCount} bulletin(s) finalisé(s)/payé(s)`}
                />
                <KpiCard icon={<Icons.IconWallet />} label={`Mois précédent (${previous.month}/${previous.year})`} value={fmtGNF(previousAmount)} />
              </div>
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}
