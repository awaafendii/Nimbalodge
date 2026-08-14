import { useState } from "react";
import { Segmented } from "../components/ui/Segmented.jsx";
import { Chip } from "../components/ui/Chip.jsx";
import { APARTMENTS } from "../data/apartments.js";

const FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "long", label: "Longue durée" },
  { value: "short", label: "Meublés" },
  { value: "issue", label: "À traiter" },
];

export function Apartments() {
  const [filter, setFilter] = useState("all");

  const list = APARTMENTS.filter((a) => {
    if (filter === "long") return a.type === "long";
    if (filter === "short") return a.type === "short";
    if (filter === "issue") return a.status === "crit" || a.status === "warn";
    return true;
  });

  return (
    <section className="view active">
      <div className="view-head">
        <div>
          <h2>Appartements &amp; unités</h2>
          <p>12 unités réparties entre baux longue durée et séjours meublés courte durée.</p>
        </div>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="apt-grid">
        {list.length ? (
          list.map((a) => (
            <div className="apt-card" key={a.id}>
              <div className="apt-top">
                <div>
                  <div className="apt-id">{a.id}</div>
                  <div className="apt-type">{a.type === "long" ? "Longue durée" : "Meublé courte durée"}</div>
                </div>
                <Chip status={a.status} />
              </div>
              <div className="apt-tenant">{a.tenant}</div>
              <div className="apt-meta">
                <span>{a.info}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">Aucune unité pour ce filtre.</div>
        )}
      </div>
    </section>
  );
}
