import { useIsFetching } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
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

import { HotelSwitcher } from "./HotelSwitcher.js";
import { ALL_NAV_ITEMS } from "./nav-config.js";
import { PendingSyncBadge } from "../common/pending-sync-panel.js";
import { useLogout } from "../../hooks/use-auth.js";
import { useAuthStore } from "../../stores/auth-store.js";
import { useUIStore } from "../../stores/ui-store.js";

// Port de docs/legacy/nimbalodge-app/src/components/layout/Topbar.jsx : titre/sous-titre dérivés de la route
// courante, burger mobile, menu utilisateur — piloté par l'utilisateur réel (GET /auth/me).
// L'icône "sync" (spinner) reflète useIsFetching() : indicateur d'activité réseau en arrière-plan
// générique (toute requête React Query en vol). PendingSyncBadge est distinct : la file de
// mutations hors ligne (Étape 6, voir offline/mutation-queue.ts).
export function Topbar() {
  const location = useLocation();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const current = ALL_NAV_ITEMS.find((item) => item.to === location.pathname);
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const isFetching = useIsFetching();

  const initials = user ? `${user.firstName.at(0) ?? ""}${user.lastName.at(0) ?? ""}`.toUpperCase() : "?";

  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar} aria-label="Menu">
        <Icons.IconBurger />
      </Button>

      <HotelSwitcher />

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-title text-lg font-[var(--fw-title)] leading-tight text-foreground">
          {current?.label ?? "NimbaLodge"}
        </h1>
        {current?.subtitle ? <p className="truncate text-xs text-muted-foreground">{current.subtitle}</p> : null}
      </div>

      {isFetching > 0 ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Synchronisation en cours" />
      ) : null}

      <PendingSyncBadge />

      <Button variant="ghost" size="icon" aria-label="Notifications" asChild>
        <Link to="/notifications">
          <Icons.IconBell />
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {user ? (
              <div className="flex flex-col">
                <span className="truncate">
                  {user.firstName} {user.lastName}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
              </div>
            ) : (
              "…"
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => logout.mutate()}>
            <LogOut className="mr-2 size-4" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
