import { fmtGNF } from "@nimbalodge/utils";
import { Card, CardContent, CardHeader, CardTitle, Icons, KpiCard, Skeleton } from "@nimbalodge/ui";

import { QueryState } from "../../components/common/query-state.js";
import { useFinanceSummary } from "../../hooks/use-finance.js";
import { useOccupancySummary } from "../../hooks/use-hospitality-insights.js";
import { useAuthStore } from "../../stores/auth-store.js";

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function fmtOccupancyRate(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)} %`;
}

function occupancyDelta(current: number | null, previous: number | null): { value: number; sentiment: "up" | "down" } | undefined {
  if (current === null || previous === null) return undefined;
  const diff = Math.round((current - previous) * 1000) / 10; // points de pourcentage
  return { value: diff, sentiment: diff >= 0 ? "up" : "down" };
}

// Chiffres réels (GET /finance/summary, GET /hospitality-insights/occupancy) — plus aucune valeur
// figée depuis la Phase 14.
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const summary = useFinanceSummary();
  const occupancy = useOccupancySummary();

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
        <CardContent>
          <QueryState
            isLoading={occupancy.isLoading}
            error={occupancy.error}
            data={occupancy.data}
            onRetry={() => occupancy.refetch()}
            renderLoading={() => (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            )}
          >
            {(data) => (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  icon={<Icons.IconBed />}
                  iconTone="good"
                  label="Taux d'occupation"
                  value={fmtOccupancyRate(data.current.occupancyRate)}
                  delta={occupancyDelta(data.current.occupancyRate, data.previous.occupancyRate)}
                  note={`${data.current.occupiedRoomNights} / ${data.current.availableRoomNights} nuits-chambre`}
                />
                <KpiCard
                  icon={<Icons.IconWallet />}
                  label="ADR (tarif moyen/nuit)"
                  value={data.current.adr === null ? "—" : fmtGNF(Number(data.current.adr))}
                />
                <KpiCard
                  icon={<Icons.IconTrend />}
                  label="RevPAR"
                  value={data.current.revpar === null ? "—" : fmtGNF(Number(data.current.revpar))}
                />
                <KpiCard icon={<Icons.IconBed />} label="Chambres actives" value={data.current.availableRooms} />
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
