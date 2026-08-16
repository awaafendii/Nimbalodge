import { NavLink } from "react-router-dom";
import { useApp } from "../../state/AppContext.jsx";
import {
  IconDashboard,
  IconBuilding,
  IconUsers,
  IconInvoice,
  IconWallet,
  IconBed,
  IconReport,
  IconGear,
  IconMark,
} from "../icons/Icons.jsx";

const NAV = [
  { to: "/dashboard", label: "Tableau de bord", icon: IconDashboard },
  { to: "/apartments", label: "Appartements", icon: IconBuilding },
  { to: "/tenants", label: "Locataires", icon: IconUsers },
  { to: "/invoices", label: "Facturation", icon: IconInvoice, badge: "late" },
  { to: "/cash-bank", label: "Caisse & Banque", icon: IconWallet },
  { to: "/furnished", label: "Séjours meublés", icon: IconBed },
  { to: "/reports", label: "Rapports mensuels", icon: IconReport },
];

export function Sidebar({ open, onNavigate }) {
  const { theme, setTheme, invoices } = useApp();
  const lateCount = invoices.filter((i) => i.status === "late").length;

  return (
    <aside className={"sidebar" + (open ? " open" : "")}>
      <div className="brand">
        <div className="brand-mark">
          <IconMark />
        </div>
        <div>
          <div className="brand-name">NimbaLodge</div>
          <div className="brand-sub">Gestion immobilière</div>
        </div>
      </div>

      <div className="property-switch">
        <span className="dot" />
        <div className="txt">
          <b>Immeuble Diaraye</b>
          <span>Coléah, Matam · Conakry</span>
        </div>
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M7 9l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <nav className="nav-group">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          >
            <item.icon />
            {item.label}
            {item.badge === "late" && lateCount > 0 ? <span className="badge-mini">{lateCount}</span> : null}
          </NavLink>
        ))}
        <div className="nav-label">Système</div>
        <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          <IconGear />
          Paramètres
        </NavLink>
      </nav>

      <div className="sidebar-foot">
        <div className="theme-row">
          {["light", "dark", "auto"].map((t) => (
            <button
              key={t}
              type="button"
              className={"theme-btn" + (theme === t ? " active" : "")}
              onClick={() => setTheme(t)}
            >
              {t === "light" ? "Clair" : t === "dark" ? "Sombre" : "Auto"}
            </button>
          ))}
        </div>
        <div className="user-card">
          <div className="avatar">LC</div>
          <div>
            <b>Lamarana Camara</b>
            <span>Gestionnaire d'immeuble</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
