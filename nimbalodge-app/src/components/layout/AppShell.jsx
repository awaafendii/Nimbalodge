import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";

const VIEW_META = {
  "/dashboard": ["Tableau de bord", "Vue d'ensemble financière — Immeuble Diaraye", true],
  "/apartments": ["Appartements", "Occupation et statut de chaque unité", false],
  "/tenants": ["Locataires", "Baux longue durée et sociétés partenaires", false],
  "/invoices": ["Facturation", "Historique et émission des factures de loyer", false],
  "/cash-bank": ["Caisse & Banque", "Journal des opérations financières", false],
  "/furnished": ["Séjours meublés", "Suivi court-séjour et répartition des recettes", false],
  "/reports": ["Rapports mensuels", "Rapport de gestion complet, prêt à exporter", false],
  "/settings": ["Paramètres", "Configuration de l'immeuble et de l'équipe", false],
};

export function AppShell() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [title, sub, showPeriod] = VIEW_META[location.pathname] || ["NimbaLodge", "", false];

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="shell">
      <div className={"scrim" + (open ? " show" : "")} onClick={() => setOpen(false)} />
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      <div className="main">
        <Topbar title={title} sub={sub} showPeriod={showPeriod} onBurger={() => setOpen((v) => !v)} />
        <div className="view-wrap">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
