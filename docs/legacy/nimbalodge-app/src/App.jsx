import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./state/AppContext.jsx";
import { ToastProvider } from "./state/ToastContext.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Apartments } from "./pages/Apartments.jsx";
import { Tenants } from "./pages/Tenants.jsx";
import { Invoices } from "./pages/Invoices.jsx";
import { CashBank } from "./pages/CashBank.jsx";
import { Furnished } from "./pages/Furnished.jsx";
import { Reports } from "./pages/Reports.jsx";
import { Settings } from "./pages/Settings.jsx";

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/apartments" element={<Apartments />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/cash-bank" element={<CashBank />} />
              <Route path="/furnished" element={<Furnished />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}
