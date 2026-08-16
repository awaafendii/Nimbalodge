import { Drawer } from "../ui/Drawer.jsx";
import { Chip } from "../ui/Chip.jsx";
import { invoiceTotal } from "../../data/invoices.js";
import { fmtDate, fmtGNF, fmtUSD } from "../../utils/format.js";
import { useToast } from "../../state/ToastContext.jsx";
import { IconDownload } from "../icons/Icons.jsx";

export function InvoiceDrawer({ invoice, onClose, onMarkPaid }) {
  const toast = useToast();
  const open = !!invoice;

  if (!invoice) {
    return <Drawer open={false} onClose={onClose} title="Aperçu de la facture" />;
  }

  const total = invoiceTotal(invoice);
  const fmt = (v) => (invoice.currency === "USD" ? fmtUSD(v) : fmtGNF(v));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Aperçu de la facture"
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onMarkPaid(invoice.num)} disabled={invoice.status === "paid"}>
            {invoice.status === "paid" ? "Déjà payée" : "Marquer payée"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => toast("Le téléchargement PDF sera disponible prochainement.")}
          >
            <IconDownload />
            Télécharger PDF
          </button>
        </>
      }
    >
      <div className="inv-paper">
        <div className="inv-head">
          <div>
            <div className="eyebrow">NimbaLodge</div>
            <h4>{invoice.num}</h4>
          </div>
          <Chip status={invoice.status} />
        </div>
        <div className="inv-meta-grid">
          <div>
            <div className="k">Client</div>
            <div className="v">{invoice.client}</div>
          </div>
          <div>
            <div className="k">Appartement</div>
            <div className="v">{invoice.appt}</div>
          </div>
          <div>
            <div className="k">Date de facturation</div>
            <div className="v tabular">{fmtDate(invoice.date)}</div>
          </div>
          <div>
            <div className="k">Date d'échéance</div>
            <div className="v tabular">{fmtDate(invoice.due)}</div>
          </div>
        </div>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qté</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.d}</td>
                <td className="num tabular">{l.q}</td>
                <td className="num tabular">{fmt(l.q * l.pu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10 }}>
          <div className="inv-total-row">
            <span>Montant hors taxes</span>
            <span className="tabular">{fmt(total)}</span>
          </div>
          <div className="inv-total-row">
            <span>T.V.A. 0%</span>
            <span className="tabular">{fmt(0)}</span>
          </div>
          <div className="inv-total-row grand">
            <span>Total</span>
            <span className="tabular">{fmt(total)}</span>
          </div>
        </div>
      </div>
      <div className="small" style={{ marginTop: 16 }}>
        Communication de paiement : <b className="tabular">{invoice.num}</b>
        <br />
        Payer à l'ordre de NimbaLodge SCI, par chèque ou virement — Ecobank RIB 7308064323.
      </div>
    </Drawer>
  );
}
