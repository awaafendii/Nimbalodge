import { createBrowserRouter, Navigate } from "react-router-dom";

import { RequireAuth } from "../components/auth/require-auth.js";
import { AppShell } from "../components/layout/AppShell.js";
import LoginPage from "../features/auth/login.js";
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
import AuditLogsPage from "../features/audit-logs/index.js";
import NotificationsPage from "../features/notifications/index.js";
import SettingsPage from "../features/settings/index.js";

// Phase 14 : /login public (RequireAuth y redirige quand aucun token valide n'est présent), tout
// le reste derrière RequireAuth → AppShell. Une route par module de nav-config.tsx.
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
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
          { path: "/audit-logs", element: <AuditLogsPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "*", element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
]);
