import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell.js";
import DashboardPage from "../features/dashboard/index.js";
import FinancePage from "../features/finance/index.js";
import ReservationsPage from "../features/reservations/index.js";
import RoomsPage from "../features/rooms/index.js";
import GuestsPage from "../features/guests/index.js";
import HrPage from "../features/hr/index.js";
import PayrollPage from "../features/payroll/index.js";
import PurchasesPage from "../features/purchases/index.js";
import InventoryPage from "../features/inventory/index.js";
import HousekeepingPage from "../features/housekeeping/index.js";
import MaintenancePage from "../features/maintenance/index.js";
import ReportsPage from "../features/reports/index.js";
import NotificationsPage from "../features/notifications/index.js";
import SettingsPage from "../features/settings/index.js";

// Pas de garde d'auth (Phase 3). Une route par module de nav-config.tsx — toutes montées, même
// vides, pour démontrer la structure complète cible (brief §43) dès la Phase 1.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/finance", element: <FinancePage /> },
      { path: "/reservations", element: <ReservationsPage /> },
      { path: "/rooms", element: <RoomsPage /> },
      { path: "/guests", element: <GuestsPage /> },
      { path: "/hr", element: <HrPage /> },
      { path: "/payroll", element: <PayrollPage /> },
      { path: "/purchases", element: <PurchasesPage /> },
      { path: "/inventory", element: <InventoryPage /> },
      { path: "/housekeeping", element: <HousekeepingPage /> },
      { path: "/maintenance", element: <MaintenancePage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/notifications", element: <NotificationsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);
