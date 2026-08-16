import { useApp } from "../state/AppContext.jsx";
import { Card, CardHead } from "../components/ui/Card.jsx";
import { Kpi } from "../components/ui/Kpi.jsx";
import { TrendChart } from "../components/charts/TrendChart.jsx";
import { ExpenseBreakdown } from "../components/charts/ExpenseBreakdown.jsx";
import { TREND, EXPENSE_CATS } from "../data/trend.js";
import { APARTMENTS } from "../data/apartments.js";
import { MONTHS, monthLabel } from "../data/months.js";
import { fmtDate, fmtGNF, money } from "../utils/format.js";
import { ledgerTotals } from "../data/ledger.js";
import { IconTrend, IconWallet, IconBed, IconWarn } from "../components/icons/Icons.jsx";
import { Link } from "react-router-dom";

function occupancyRate() {
  const occ = APARTMENTS.filter((a) => a.status !== "vacant").length;
  return Math.round((occ / APARTMENTS.length) * 100);
}
function lateApartments() {
  return APARTMENTS.filter((a) => a.status === "crit");
}

export function Dashboard() {
  const { period, currency, caisse } = useApp();
  const idx = Math.max(0, MONTHS.findIndex((m) => m.key === period));
  const trend = TREND[idx];
  const prev = TREND[idx - 1] || trend;
  const recPct = prev.rec ? Math.round(((trend.rec - prev.rec) / prev.rec) * 1000) / 10 : 0;
  const depPct = prev.dep ? Math.round(((trend.dep - prev.dep) / prev.dep) * 1000) / 10 : 0;
  const { solde } = ledgerTotals(caisse);
  const late = lateApartments();

  const recentTxns = caisse.slice(-5).reverse();

  return (
    <section className="view active">
      <div className="grid-kpi">
        <Kpi
          icon={<IconTrend />}
          iconClass="good"
          label="Recettes du mois"
          value={money(trend.rec, currency)}
          delta={{ value: recPct, sentiment: recPct >= 0 ? "up" : "down" }}
        />
        <Kpi
          icon={<IconWallet />}
          iconClass="gold"
          label="Dépenses du mois"
          value={money(trend.dep, currency)}
          delta={{ value: depPct, sentiment: depPct <= 0 ? "up" : "down" }}
        />
        <Kpi
          icon={<IconWallet />}
          label="Solde caisse courant"
          value={money(solde, currency)}
          note={"Journal — " + monthLabel("2026-07")}
        />
        <Kpi
          icon={<IconBed />}
          iconClass={late.length ? "crit" : "good"}
          label="Taux d'occupation"
          value={occupancyRate() + "%"}
          note={late.length + " loyer(s) en retard"}
        />
      </div>

      <div className="two-col">
        <Card>
          <CardHead title="Recettes vs dépenses" hint="6 derniers mois" />
          <div className="card-pad" style={{ paddingTop: 8 }}>
            <TrendChart data={TREND} />
            <div className="legend" style={{ marginTop: 6 }}>
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: "var(--chart-1)" }} />
                Recettes
              </span>
              <span className="legend-item">
                <span className="legend-swatch" style={{ background: "var(--ink-muted)" }} />
                Dépenses
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Répartition des dépenses" hint="Mois en cours" />
          <div className="card-pad" style={{ paddingTop: 12 }}>
            <ExpenseBreakdown categories={EXPENSE_CATS} />
          </div>
        </Card>
      </div>

      <div className="two-col">
        <Card>
          <CardHead
            title="Activité récente — caisse & banque"
            right={
              <Link to="/cash-bank" className="hint" style={{ cursor: "pointer", color: "var(--accent-ink)", fontWeight: 600 }}>
                Voir tout →
              </Link>
            }
          />
          <div className="scrollx">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opération</th>
                  <th>Bénéficiaire</th>
                  <th className="num">Débit</th>
                  <th className="num">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((t, i) => (
                  <tr key={i}>
                    <td>{fmtDate(t.date)}</td>
                    <td>{t.label}</td>
                    <td>{t.who}</td>
                    <td className="num tabular">{t.debit ? fmtGNF(t.debit) : "—"}</td>
                    <td className="num tabular">{t.credit ? fmtGNF(t.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead title="Alertes & échéances" right={<span className="chip crit">{late.length} urgent(s)</span>} />
          <div className="card-pad">
            {late.map((a) => (
              <div className="alert-row" key={a.id}>
                <span className="alert-dot">
                  <IconWarn />
                </span>
                <div>
                  <div className="t">
                    {a.tenant} — Appt. {a.id}
                  </div>
                  <div className="d">{a.info}</div>
                </div>
                <span className="amt" style={{ color: "var(--critical)" }}>
                  Relancer
                </span>
              </div>
            ))}
            <div className="alert-row">
              <span className="alert-dot" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
                <IconWarn />
              </span>
              <div>
                <div className="t">Facture VIVO ENERGY — réparation ampoules</div>
                <div className="d">En attente depuis le 11/09/2025</div>
              </div>
              <span className="amt" style={{ color: "var(--warning)" }}>
                À suivre
              </span>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
