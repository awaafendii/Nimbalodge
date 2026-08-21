import { createBrowserRouter, Navigate } from "react-router-dom";

import { RequireAuth } from "../components/auth/require-auth.js";
import { AppShell } from "../components/layout/AppShell.js";
import ForgotPasswordPage from "../features/auth/forgot-password.js";
import LoginPage from "../features/auth/login.js";
import ResetPasswordPage from "../features/auth/reset-password.js";
import DashboardPage from "../features/dashboard/index.js";
import FinanceBankPage from "../features/finance/bank-page.js";
import FinanceBudgetsPage from "../features/finance/budgets-page.js";
import FinanceCashPage from "../features/finance/cash-page.js";
import FinanceExpensesPage from "../features/finance/expenses-page.js";
import FinanceLayout from "../features/finance/finance-layout.js";
import FinanceInvoicesPage from "../features/finance/invoices-page.js";
import { FinanceOverviewPage } from "../features/finance/overview-page.js";
import FinanceRevenuesPage from "../features/finance/revenues-page.js";
import HrAttendancePage from "../features/hr/attendance-page.js";
import HrEmployeesPage from "../features/hr/employees-page.js";
import HrLayout from "../features/hr/hr-layout.js";
import HrLeavePage from "../features/hr/leave-page.js";
import { HrOverviewPage } from "../features/hr/overview-page.js";
import HrPayrollPage from "../features/hr/payroll-page.js";
import HebergementLayout from "../features/hebergement/hebergement-layout.js";
import { HebergementOverviewPage } from "../features/hebergement/overview-page.js";
import HebergementReservationsPage from "../features/hebergement/reservations-page.js";
import HebergementRoomsPage from "../features/hebergement/rooms-page.js";
import HebergementGuestsPage from "../features/hebergement/guests-page.js";
import PurchasesPage from "../features/purchases/index.js";
import StocksLayout from "../features/stocks/stocks-layout.js";
import { StocksOverviewPage } from "../features/stocks/overview-page.js";
import StocksProductsPage from "../features/stocks/products-page.js";
import StocksMovementsPage from "../features/stocks/movements-page.js";
import StocksWarehousesPage from "../features/stocks/warehouses-page.js";
import HousekeepingPage from "../features/housekeeping/index.js";
import MaintenancePage from "../features/maintenance/index.js";
import ReportsPage from "../features/reports/index.js";
import AuditLogsPage from "../features/audit-logs/index.js";
import NimbaAiPage from "../features/nimba-ai/index.js";
import NotificationsPage from "../features/notifications/index.js";
import SettingsPage from "../features/settings/index.js";

// Phase 14 : /login public (RequireAuth y redirige quand aucun token valide n'est présent), tout
// le reste derrière RequireAuth → AppShell. Une route par module de nav-config.tsx.
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          {
            path: "/finance",
            element: <FinanceLayout />,
            children: [
              { index: true, element: <FinanceOverviewPage /> },
              { path: "revenues", element: <FinanceRevenuesPage /> },
              { path: "expenses", element: <FinanceExpensesPage /> },
              { path: "cash", element: <FinanceCashPage /> },
              { path: "bank", element: <FinanceBankPage /> },
              { path: "budgets", element: <FinanceBudgetsPage /> },
              { path: "invoices", element: <FinanceInvoicesPage /> },
            ],
          },
          {
            path: "/hebergement",
            element: <HebergementLayout />,
            children: [
              { index: true, element: <HebergementOverviewPage /> },
              { path: "reservations", element: <HebergementReservationsPage /> },
              { path: "rooms", element: <HebergementRoomsPage /> },
              { path: "guests", element: <HebergementGuestsPage /> },
            ],
          },
          {
            path: "/hr",
            element: <HrLayout />,
            children: [
              { index: true, element: <HrOverviewPage /> },
              { path: "employees", element: <HrEmployeesPage /> },
              { path: "leave", element: <HrLeavePage /> },
              { path: "attendance", element: <HrAttendancePage /> },
              { path: "payroll", element: <HrPayrollPage /> },
            ],
          },
          { path: "/purchases", element: <PurchasesPage /> },
          {
            path: "/stocks",
            element: <StocksLayout />,
            children: [
              { index: true, element: <StocksOverviewPage /> },
              { path: "products", element: <StocksProductsPage /> },
              { path: "movements", element: <StocksMovementsPage /> },
              { path: "warehouses", element: <StocksWarehousesPage /> },
            ],
          },
          { path: "/housekeeping", element: <HousekeepingPage /> },
          { path: "/maintenance", element: <MaintenancePage /> },
          { path: "/reports", element: <ReportsPage /> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/audit-logs", element: <AuditLogsPage /> },
          { path: "/nimba-ai", element: <NimbaAiPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "*", element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
]);
