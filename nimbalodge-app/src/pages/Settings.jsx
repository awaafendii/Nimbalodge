import { useState } from "react";
import { useToast } from "../state/ToastContext.jsx";
import { Card } from "../components/ui/Card.jsx";
import { EMPLOYEES } from "../data/employees.js";
import { fmtGNF } from "../utils/format.js";

const FIELDS = [
  { key: "name", label: "Nom de l'immeuble", full: false, value: "Immeuble Diaraye" },
  { key: "rccm", label: "Référence RCCM", full: false, value: "GN.TCC.2024.B.14567" },
  { key: "address", label: "Adresse", full: true, value: "Appartement 10B, Immeuble Nimba, Coléah, Commune de Matam, Conakry" },
  { key: "phone", label: "Téléphone", full: false, value: "+224 628 29 25 05" },
  { key: "bank", label: "Banque principale", full: false, value: "Ecobank Guinée — RIB 7308064323" },
  { key: "fx", label: "Taux de change (1 USD)", full: false, value: "9 300 GNF" },
  { key: "commission", label: "Commission mandataire (meublés)", full: false, value: "10 %" },
];

export function Settings() {
  const toast = useToast();
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, f.value])));

  function handleChange(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <section className="view active">
      <div className="view-head">
        <div>
          <h2>Paramètres</h2>
          <p>Informations de l'immeuble, devises et équipe permanente.</p>
        </div>
      </div>

      <div className="settings-grid">
        <Card className="card-pad">
          <h3 style={{ marginBottom: 14 }}>Fiche de l'immeuble</h3>
          <div className="form-grid">
            {FIELDS.map((f) => (
              <div className={"field" + (f.full ? " full" : "")} key={f.key}>
                <label>{f.label}</label>
                <input value={values[f.key]} onChange={(e) => handleChange(f.key, e.target.value)} />
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => toast("Modifications enregistrées.")}>
            Enregistrer les modifications
          </button>
        </Card>

        <Card className="card-pad">
          <h3 style={{ marginBottom: 6 }}>Équipe permanente</h3>
          <p className="small" style={{ margin: "0 0 6px" }}>
            Masse salariale mensuelle — 8 200 000 GNF
          </p>
          <div>
            {EMPLOYEES.map((e) => (
              <div className="emp-row" key={e.name}>
                <span className="avatar-sm">{e.init}</span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 12.9 }}>{e.name}</b>
                  <div className="sub" style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
                    {e.role}
                  </div>
                </div>
                <div className="tabular" style={{ fontWeight: 600, fontSize: 12.6 }}>
                  {e.salary ? fmtGNF(e.salary) : "Variable"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
