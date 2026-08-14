import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Segmented } from "../components/ui/Segmented.jsx";
import { Kpi } from "../components/ui/Kpi.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { runningBalance, ledgerTotals } from "../data/ledger.js";
import { CURRENT_LEDGER_MONTH, monthLabel } from "../data/months.js";
import { fmtDate, fmtGNF } from "../utils/format.js";
import { IconPlus, IconTrend, IconWallet } from "../components/icons/Icons.jsx";

const LEDGER_TABS = [
  { value: "caisse", label: "Caisse" },
  { value: "banque", label: "Banque / chèques" },
];

function AddTransactionModal({ open, onClose, onAdd }) {
  const [label, setLabel] = useState("");
  const [who, setWho] = useState("");
  const [kind, setKind] = useState("credit"); // debit = entrée, credit = sortie
  const [amount, setAmount] = useState("");

  function reset() {
    setLabel("");
    setWho("");
    setKind("credit");
    setAmount("");
  }
  function handleClose() {
    reset();
    onClose();
  }
  function handleSave() {
    if (!label.trim() || !amount) return;
    const value = parseFloat(amount) || 0;
    onAdd({
      date: `2026-07-${String(Math.min(28, new Date().getDate())).padStart(2, "0")}`,
      ref: "Caisse",
      label: label.trim(),
      who: who.trim() || "Manuel",
      debit: kind === "debit" ? value : 0,
      credit: kind === "credit" ? value : 0,
    });
    reset();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Ajouter une opération"
      footer={
        <>
          <button className="btn btn-ghost" onClick={handleClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Ajouter
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <label>Libellé</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Recharge EDG au 1B" />
        </div>
        <div className="field full">
          <label>Bénéficiaire</label>
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Ex. EDG" />
        </div>
        <div className="field">
          <label>Type</label>
          <Segmented
            options={[
              { value: "debit", label: "Entrée" },
              { value: "credit", label: "Sortie" },
            ]}
            value={kind}
            onChange={setKind}
          />
        </div>
        <div className="field">
          <label>Montant (GNF)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
      </div>
    </Modal>
  );
}

export function CashBank() {
  const { caisse, banque, addTransaction } = useApp();
  const toast = useToast();
  const [ledger, setLedger] = useState("caisse");
  const [modalOpen, setModalOpen] = useState(false);

  const txns = ledger === "caisse" ? caisse : banque;
  const rows = useMemo(() => runningBalance(txns), [txns]);
  const { totalDebit, totalCredit, solde } = useMemo(() => ledgerTotals(txns), [txns]);

  function handleAdd(txn) {
    addTransaction(ledger, txn);
    setModalOpen(false);
    toast("Opération ajoutée au journal.");
  }

  return (
    <section className="view active">
      <div className="view-head">
        <div>
          <h2>Caisse &amp; Banque</h2>
          <p>Journal des opérations avec solde courant, conforme au suivi mensuel de gestion.</p>
        </div>
        <Segmented options={LEDGER_TABS} value={ledger} onChange={setLedger} />
      </div>

      <div className="grid-kpi">
        <Kpi icon={<IconTrend />} iconClass="good" label="Total débit (entrées)" value={fmtGNF(totalDebit)} />
        <Kpi icon={<IconWallet />} iconClass="gold" label="Total crédit (sorties)" value={fmtGNF(totalCredit)} />
        <Kpi icon={<IconWallet />} label="Solde restant" value={fmtGNF(solde)} />
        <Kpi icon={<IconTrend />} iconClass="good" label="Opérations enregistrées" value={txns.length} />
      </div>

      <Card>
        <div className="card-head" style={{ paddingBottom: 14 }}>
          <h3>
            {ledger === "caisse" ? "Journal de caisse" : "Journal banque / chèques"} — {monthLabel(CURRENT_LEDGER_MONTH)}
          </h3>
          <button className="btn btn-soft btn-sm" onClick={() => setModalOpen(true)}>
            <IconPlus />
            Ajouter une opération
          </button>
        </div>
        <div className="scrollx">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Réf.</th>
                <th>Opération</th>
                <th>Bénéficiaire</th>
                <th className="num">Débit</th>
                <th className="num">Crédit</th>
                <th className="num">Solde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={i}>
                  <td className="tabular">{fmtDate(t.date)}</td>
                  <td style={{ fontSize: 11.6, color: "var(--ink-muted)" }}>{t.ref}</td>
                  <td>{t.label}</td>
                  <td>{t.who}</td>
                  <td className="num tabular">{t.debit ? fmtGNF(t.debit) : "—"}</td>
                  <td className="num tabular">{t.credit ? fmtGNF(t.credit) : "—"}</td>
                  <td className="num tabular" style={{ fontWeight: 600 }}>
                    {fmtGNF(t.solde)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Totaux</td>
                <td className="num tabular">{fmtGNF(totalDebit)}</td>
                <td className="num tabular">{fmtGNF(totalCredit)}</td>
                <td className="num tabular">{fmtGNF(solde)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAdd} />
    </section>
  );
}
