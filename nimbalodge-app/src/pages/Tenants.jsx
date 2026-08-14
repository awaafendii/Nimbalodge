import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card.jsx";
import { Chip } from "../components/ui/Chip.jsx";
import { TENANTS } from "../data/tenants.js";
import { fmtGNF, fmtUSD, initials } from "../utils/format.js";
import { IconSearch } from "../components/icons/Icons.jsx";

export function Tenants() {
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.toLowerCase();
    return TENANTS.filter((t) => t.name.toLowerCase().includes(q) || t.appts.toLowerCase().includes(q));
  }, [query]);

  return (
    <section className="view active">
      <div className="view-head">
        <div>
          <h2>Locataires</h2>
          <p>Sociétés et particuliers en bail longue durée, avec statut de paiement à jour.</p>
        </div>
        <div className="search-input">
          <IconSearch />
          <input
            placeholder="Rechercher un locataire ou un appartement…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <div className="card-pad">
          {list.length ? (
            list.map((t) => (
              <div className="tenant-row" key={t.name}>
                <span className="avatar-sm">{initials(t.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cellflex">
                    <b>{t.name}</b>
                    <Chip status={t.status} />
                  </div>
                  <div className="sub">
                    {t.type} · Appt. {t.appts} · {t.period}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="tabular" style={{ fontWeight: "var(--fw-subtitle-strong)", fontSize: 13.4 }}>
                    {t.currency === "USD" ? fmtUSD(t.amount) : fmtGNF(t.amount)}
                  </div>
                  <div className="sub" style={{ fontSize: 11 }}>
                    par trimestre
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Aucun locataire trouvé.</div>
          )}
        </div>
      </Card>
    </section>
  );
}
