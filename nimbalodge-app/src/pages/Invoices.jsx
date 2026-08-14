import { useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Segmented } from "../components/ui/Segmented.jsx";
import { Chip } from "../components/ui/Chip.jsx";
import { InvoiceDrawer } from "../components/invoices/InvoiceDrawer.jsx";
import { NewInvoiceDrawer } from "../components/invoices/NewInvoiceDrawer.jsx";
import { invoiceTotal } from "../data/invoices.js";
import { fmtDate, fmtGNF, fmtUSD } from "../utils/format.js";
import { IconPlus } from "../components/icons/Icons.jsx";

const FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "paid", label: "Payées" },
  { value: "pending", label: "En attente" },
  { value: "late", label: "En retard" },
];

export function Invoices() {
  const { invoices, addInvoice, markInvoicePaid } = useApp();
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  const list = invoices.filter((i) => filter === "all" || i.status === filter);

  function handleSave(invoice) {
    addInvoice(invoice);
    setCreating(false);
    toast(`Facture ${invoice.num} émise avec succès.`);
  }

  function handleMarkPaid(num) {
    markInvoicePaid(num);
    setSelected((s) => (s ? { ...s, status: "paid" } : s));
    toast("Facture marquée comme payée.");
  }

  return (
    <section className="view active">
      <div className="view-head">
        <div>
          <h2>Facturation</h2>
          <p>Factures de loyer émises pour l'ensemble des sociétés et locataires.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <IconPlus />
          Nouvelle facture
        </button>
      </div>

      <Card>
        <div className="card-head" style={{ paddingBottom: 14 }}>
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />
          <span className="hint">{list.length} facture(s)</span>
        </div>
        <div className="scrollx">
          <table>
            <thead>
              <tr>
                <th>Facture</th>
                <th>Client</th>
                <th>Appartement</th>
                <th>Échéance</th>
                <th className="num">Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                list.map((inv) => (
                  <tr className="rowlink" key={inv.num} onClick={() => setSelected(inv)}>
                    <td className="tabular" style={{ fontSize: 12.2, color: "var(--ink-2)" }}>
                      {inv.num}
                    </td>
                    <td>{inv.client}</td>
                    <td>{inv.appt}</td>
                    <td className="tabular">{fmtDate(inv.due)}</td>
                    <td className="num tabular">
                      {inv.currency === "USD" ? fmtUSD(invoiceTotal(inv)) : fmtGNF(invoiceTotal(inv))}
                    </td>
                    <td>
                      <Chip status={inv.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">Aucune facture pour ce filtre.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <InvoiceDrawer invoice={selected} onClose={() => setSelected(null)} onMarkPaid={handleMarkPaid} />
      <NewInvoiceDrawer open={creating} onClose={() => setCreating(false)} invoiceCount={invoices.length} onSave={handleSave} />
    </section>
  );
}
