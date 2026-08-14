import { useApp } from "../../state/AppContext.jsx";
import { MONTHS } from "../../data/months.js";
import { IconBurger, IconBell } from "../icons/Icons.jsx";

export function Topbar({ title, sub, onBurger, showPeriod = true }) {
  const { period, setPeriod, currency, setCurrency } = useApp();

  return (
    <header className="topbar">
      <button className="burger" onClick={onBurger} aria-label="Ouvrir le menu">
        <IconBurger />
      </button>
      <div className="topbar-titles">
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      <div className="topbar-spacer" />
      {showPeriod ? (
        <select className="field-select no-print" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {MONTHS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      ) : null}
      <div className="curr-toggle no-print">
        {["GNF", "USD"].map((c) => (
          <button key={c} type="button" className={currency === c ? "active" : ""} onClick={() => setCurrency(c)}>
            {c}
          </button>
        ))}
      </div>
      <button className="icon-btn no-print" title="Notifications">
        <IconBell />
      </button>
    </header>
  );
}
