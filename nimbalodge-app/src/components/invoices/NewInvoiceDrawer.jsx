import { useEffect, useState } from "react";
import { Drawer } from "../ui/Drawer.jsx";
import { fmtGNF } from "../../utils/format.js";
import { IconPlus, IconClose } from "../icons/Icons.jsx";

function blankLine() {
  return { id: Math.random().toString(36).slice(2), d: "Location Appartement", q: 1, pu: 11_160_000 };
}

function nextInvoiceNumber(count) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `FAC/${y}/${m}/${String(count + 1).padStart(5, "0")}`;
}

export function NewInvoiceDrawer({ open, onClose, invoiceCount, onSave }) {
  const [client, setClient] = useState("");
  const [appt, setAppt] = useState("");
  const [due, setDue] = useState("");
  const [lines, setLines] = useState([blankLine()]);

  useEffect(() => {
    if (open) {
      setClient("");
      setAppt("");
      setDue("");
      setLines([blankLine()]);
    }
  }, [open]);

  const total = lines.reduce((s, l) => s + (parseFloat(l.q) || 0) * (parseFloat(l.pu) || 0), 0);

  function updateLine(id, field, value) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }
  function removeLine(id) {
    setLines((ls) => ls.filter((l) => l.id !== id));
  }

  function handleSave() {
    const today = new Date().toISOString().slice(0, 10);
    const invoice = {
      num: nextInvoiceNumber(invoiceCount),
      client: client.trim() || "Nouveau client",
      appt: appt.trim() || "—",
      date: today,
      due: due || today,
      status: "pending",
      lines: lines
        .filter((l) => l.d.trim())
        .map((l) => ({ d: l.d, q: parseFloat(l.q) || 1, pu: parseFloat(l.pu) || 0 })),
    };
    onSave(invoice);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nouvelle facture"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Émettre la facture
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <label>Client / société</label>
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Ex. Fox Cooling SARL" />
        </div>
        <div className="field">
          <label>Appartement</label>
          <input value={appt} onChange={(e) => setAppt(e.target.value)} placeholder="Ex. 5B" />
        </div>
        <div className="field">
          <label>Échéance</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>

      <hr className="rule" style={{ margin: "16px 0" }} />
      <label style={{ fontSize: 11.6, fontWeight: "var(--fw-small-strong)", color: "var(--ink-2)" }}>Lignes de facture</label>
      <div className="lineitems" style={{ marginTop: 8 }}>
        {lines.map((l) => (
          <div className="lineitem" key={l.id}>
            <input
              type="text"
              placeholder="Description"
              value={l.d}
              onChange={(e) => updateLine(l.id, "d", e.target.value)}
            />
            <input
              type="number"
              placeholder="Qté"
              value={l.q}
              onChange={(e) => updateLine(l.id, "q", e.target.value)}
            />
            <input
              type="number"
              placeholder="Prix unitaire"
              value={l.pu}
              onChange={(e) => updateLine(l.id, "pu", e.target.value)}
            />
            <button type="button" className="iconbtn-mini" onClick={() => removeLine(l.id)} aria-label="Supprimer la ligne">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setLines((ls) => [...ls, blankLine()])}>
        <IconPlus />
        Ajouter une ligne
      </button>

      <hr className="rule" style={{ margin: "16px 0" }} />
      <div className="inv-total-row grand">
        <span>Total</span>
        <span className="tabular">{fmtGNF(total)}</span>
      </div>
    </Drawer>
  );
}
