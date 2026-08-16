import { useMemo } from "react";
import { useApp } from "../state/AppContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { TENANTS } from "../data/tenants.js";
import { FURNISHED, furnishedSummary } from "../data/furnished.js";
import { ledgerTotals } from "../data/ledger.js";
import { OBSERVATIONS } from "../data/employees.js";
import { MONTHS, CURRENT_LEDGER_MONTH, monthLabel } from "../data/months.js";
import { Chip } from "../components/ui/Chip.jsx";
import { fmtGNF } from "../utils/format.js";
import { IconPrint, IconLeaf } from "../components/icons/Icons.jsx";

export function Reports() {
  const { caisse } = useApp();
  const toast = useToast();
  const { totalDebit, totalCredit, solde } = ledgerTotals(caisse);
  const furnSummary = useMemo(() => furnishedSummary(FURNISHED), []);
  const generatedOn = useMemo(() => new Date().toLocaleDateString("fr-FR"), []);

  function handleMonthChange(e) {
    if (e.target.value !== CURRENT_LEDGER_MONTH) {
      toast(`Rapport détaillé disponible pour ${monthLabel(CURRENT_LEDGER_MONTH)} — les archives des mois précédents se consultent depuis l'historique.`);
    }
  }

  return (
    <section className="view active">
      <div className="view-head no-print">
        <div>
          <h2>Rapports mensuels</h2>
          <p>Génère automatiquement le rapport de gestion complet de l'immeuble, prêt à exporter.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select className="field-select" defaultValue={CURRENT_LEDGER_MONTH} onChange={handleMonthChange}>
            {MONTHS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <IconPrint />
            Imprimer / Exporter
          </button>
        </div>
      </div>

      <div className="report-sheet">
        <div className="rs-header">
          <div className="tag">NimbaLodge · Rapport mensuel de gestion</div>
          <h3>Immeuble Diaraye — {monthLabel(CURRENT_LEDGER_MONTH)}</h3>
          <div className="sub">
            Période du 01/07/2026 au 31/07/2026 · généré automatiquement le {generatedOn}
          </div>
        </div>

        <div className="report-body">
          <div className="report-section">
            <div className="rs-title">
              <span className="n">1</span>
              <h4>Situation de la caisse</h4>
            </div>
            <div className="grid-kpi" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="kpi">
                <div className="kpi-label">Total débit</div>
                <div className="kpi-value tabular" style={{ fontSize: 18 }}>
                  {fmtGNF(totalDebit)}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Total crédit</div>
                <div className="kpi-value tabular" style={{ fontSize: 18 }}>
                  {fmtGNF(totalCredit)}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Solde restant</div>
                <div className="kpi-value tabular" style={{ fontSize: 18 }}>
                  {fmtGNF(solde)}
                </div>
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="rs-title">
              <span className="n">2</span>
              <h4>Factures &amp; paiement des loyers</h4>
            </div>
            <div className="card" style={{ borderRadius: 12 }}>
              <div style={{ padding: "4px 16px" }}>
                {TENANTS.map((t) => (
                  <div className="tenant-row" key={t.name}>
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 12.8 }}>{t.name}</b>
                      <div className="sub" style={{ fontSize: 11.6, color: "var(--ink-muted)" }}>
                        Appt. {t.appts} · {t.period}
                      </div>
                    </div>
                    <Chip status={t.status === "good" ? "paid" : "late"} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="report-section">
            <div className="rs-title">
              <span className="n">3</span>
              <h4>Suivi des appartements meublés</h4>
            </div>
            <p style={{ fontSize: 12.8, color: "var(--ink-2)", margin: "0 0 10px" }}>
              Total des recettes : <b className="tabular">{fmtGNF(furnSummary.total)}</b> — après déduction de la part
              mandataire (10%), des frais de ménage et de l'avance de caisse, le montant net s'élève à :
            </p>
            <div className="stat tabular" style={{ fontSize: 22, color: "var(--accent-ink)" }}>
              {fmtGNF(furnSummary.net)}
            </div>
          </div>

          <div className="report-section">
            <div className="rs-title">
              <span className="n">4</span>
              <h4>Entretien &amp; observations</h4>
            </div>
            {OBSERVATIONS.map((o, i) => (
              <div className="obs-item" key={i}>
                <IconLeaf />
                <span>{o}</span>
              </div>
            ))}
          </div>

          <div className="report-section">
            <div className="rs-title">
              <span className="n">5</span>
              <h4>Conclusion</h4>
            </div>
            <p style={{ fontSize: 12.8, color: "var(--ink-2)", lineHeight: 1.7, margin: 0 }}>
              Le mois de juillet a été consacré à la gestion courante de l'immeuble, avec une attention particulière
              portée au recouvrement des loyers en retard et à l'amélioration continue des conditions de séjour des
              locataires meublés. L'objectif reste d'assurer une gestion rigoureuse, transparente et efficace de
              l'ensemble du patrimoine.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
