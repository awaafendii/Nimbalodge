import { useMemo } from "react";
import { useApp } from "../state/AppContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { Card, CardHead } from "../components/ui/Card.jsx";
import { FURNISHED, nightsBetween, furnishedSummary, COMMISSION_RATE, CLEANING_FEE, CASH_ADVANCE } from "../data/furnished.js";
import { MONTHS, CURRENT_LEDGER_MONTH, monthLabel } from "../data/months.js";
import { fmtDate, fmtGNF } from "../utils/format.js";

export function Furnished() {
  const { period, setPeriod } = useApp();
  const toast = useToast();
  const summary = useMemo(() => furnishedSummary(FURNISHED), []);

  function handleMonthChange(e) {
    const value = e.target.value;
    if (value !== CURRENT_LEDGER_MONTH) {
      toast(`Données détaillées disponibles pour ${monthLabel(CURRENT_LEDGER_MONTH)} — les mois précédents s'archivent automatiquement chaque clôture.`);
      return;
    }
    setPeriod(value);
  }

  return (
    <section className="view active">
      <div className="view-head">
        <div>
          <h2>Séjours meublés</h2>
          <p>Suivi des entrées/sorties des unités 1A–1D et calcul automatique de la part mandataire.</p>
        </div>
        <select className="field-select" value={CURRENT_LEDGER_MONTH} onChange={handleMonthChange}>
          {MONTHS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="two-col">
        <Card>
          <CardHead title="Occupations du mois" hint={summary.totalNights + " nuitées"} />
          <div className="scrollx">
            <table>
              <thead>
                <tr>
                  <th>Appt.</th>
                  <th>Locataire</th>
                  <th>Entrée</th>
                  <th>Sortie</th>
                  <th className="num">Nuits</th>
                  <th className="num">Tarif / jour</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {FURNISHED.map((f) => {
                  const n = nightsBetween(f.entry, f.exit);
                  return (
                    <tr key={f.appt}>
                      <td>
                        <b>{f.appt}</b>
                      </td>
                      <td>{f.tenant}</td>
                      <td className="tabular">{fmtDate(f.entry)}</td>
                      <td className="tabular">{fmtDate(f.exit)}</td>
                      <td className="num tabular">{n}</td>
                      <td className="num tabular">{fmtGNF(f.rate)}</td>
                      <td className="num tabular" style={{ fontWeight: 600 }}>
                        {fmtGNF(n * f.rate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>Total recettes</td>
                  <td className="num tabular">{fmtGNF(summary.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead title="Répartition des recettes" />
          <div className="card-pad">
            <div className="calc-list">
              <div className="calc-row">
                <span className="lbl">Total des recettes</span>
                <span className="val">{fmtGNF(summary.total)}</span>
              </div>
              <div className="calc-row sub">
                <span className="lbl">− Part du mandataire ({COMMISSION_RATE * 100}%)</span>
                <span className="val">− {fmtGNF(summary.commission)}</span>
              </div>
              <div className="calc-row">
                <span className="lbl">= Sous-total</span>
                <span className="val">{fmtGNF(summary.afterCommission)}</span>
              </div>
              <div className="calc-row sub">
                <span className="lbl">− Frais de ménage</span>
                <span className="val">− {fmtGNF(CLEANING_FEE)}</span>
              </div>
              <div className="calc-row">
                <span className="lbl">= Sous-total</span>
                <span className="val">{fmtGNF(summary.afterCleaning)}</span>
              </div>
              <div className="calc-row sub">
                <span className="lbl">− Avance caisse (Iliassa)</span>
                <span className="val">− {fmtGNF(CASH_ADVANCE)}</span>
              </div>
              <div className="calc-row total">
                <span className="lbl">Net à reverser</span>
                <span className="val">{fmtGNF(summary.net)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
