import { Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@nimbalodge/ui";

import { Sidebar } from "./Sidebar.js";
import { Topbar } from "./Topbar.js";
import { OfflineBanner } from "../common/offline-banner.js";
import { useUIStore } from "../../stores/ui-store.js";

// Port de docs/legacy/nimbalodge-app/src/components/layout/AppShell.jsx : sidebar fixe en desktop, off-canvas
// (Sheet shadcn) en mobile — remplace le scrim/aside manuel du prototype legacy.
export function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const closeSidebar = useUIStore((s) => s.closeSidebar);

  return (
    <div className="flex h-dvh bg-background text-foreground">
      <aside className="hidden w-64 flex-none lg:block">
        <Sidebar />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={(open) => !open && closeSidebar()}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={closeSidebar} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
