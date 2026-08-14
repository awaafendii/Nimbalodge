import { useLocation } from "react-router-dom";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icons,
} from "@nimbalodge/ui";

import { ALL_NAV_ITEMS } from "./nav-config.js";
import { useUIStore } from "../../stores/ui-store.js";

// Port de nimbalodge-app/src/components/layout/Topbar.jsx : titre/sous-titre dérivés de la route
// courante (via nav-config, source unique avec Sidebar), burger mobile, menu utilisateur.
export function Topbar() {
  const location = useLocation();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const current = ALL_NAV_ITEMS.find((item) => item.to === location.pathname);

  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar} aria-label="Menu">
        <Icons.IconBurger />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-title text-lg font-[var(--fw-title)] leading-tight text-foreground">
          {current?.label ?? "NimbaLodge"}
        </h1>
        {current?.subtitle ? <p className="truncate text-xs text-muted-foreground">{current.subtitle}</p> : null}
      </div>

      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Icons.IconBell />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar>
              <AvatarFallback>?</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Non connecté</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Authentification — Phase 3</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
