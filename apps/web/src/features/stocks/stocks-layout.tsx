import { Outlet } from "react-router-dom";

// Coquille du module Stocks (architecture module → sous-module, même pattern que Finance/RH).
// Navigation entre sous-modules via la Sidebar uniquement, pas de bandeau d'onglets.
export default function StocksLayout() {
  return <Outlet />;
}
