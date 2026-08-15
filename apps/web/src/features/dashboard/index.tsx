import { fmtGNF } from "@nimbalodge/utils";
import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, Skeleton } from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useFinanceSummary } from "../../hooks/use-finance.js";
import { useAuthStore } from "../../stores/auth-store.js";

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// Chiffres réels (GET /finance/summary) — plus aucune valeur figée depuis la Phase 14. Les
// modules non encore branchés (occupation → Phase 7 côté backend, déjà prêt via GET /rooms/available
// mais pas encore consommé ici) restent explicitement "—" plutôt que fabriqués.
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const summary = useFinanceSummary();

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            {user?.hotel
              ? user.hotel.name
              : user
                ? `${user.organization.name} — vue consolidée, tous hôtels`
                : "…"}
          </p>
        </CardContent>
      </Card>

      <QueryState
        isLoading={summary.isLoading}
        error={summary.error}
        data={summary.data}
        onRetry={() => summary.refetch()}
        renderLoading={() => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        )}
      >
        {(data) => {
          const monthLabel = `${MONTH_NAMES[data.period.month - 1]} ${data.period.year}`;
          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={<Icons.IconTrend />}
                iconTone="good"
                label={`Recettes — ${monthLabel}`}
                value={fmtGNF(Number(data.totalRevenue))}
              />
              <KpiCard
                icon={<Icons.IconWallet />}
                iconTone="gold"
                label={`Dépenses — ${monthLabel}`}
                value={fmtGNF(Number(data.totalExpense))}
              />
              <KpiCard icon={<Icons.IconWallet />} label="Solde caisse" value={fmtGNF(Number(data.cashBalance))} />
              <KpiCard icon={<Icons.IconWallet />} label="Solde banque" value={fmtGNF(Number(data.bankBalance))} />
            </div>
          );
        }}
      </QueryState>

      <Card>
        <CardHeader>
          <CardTitle>Occupation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Le taux d'occupation temps réel n'est pas encore branché sur ce tableau de bord — la
          disponibilité par chambre est calculée par l'API (<code>GET /rooms/available</code>) mais
          n'est pas encore agrégée ici en KPI.
        </CardContent>
      </Card>
    </div>
  );
}
