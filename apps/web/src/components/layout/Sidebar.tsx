import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Icons, ToggleGroup, ToggleGroupItem, cn } from "@nimbalodge/ui";

import { NAV_GROUPS } from "./nav-config.js";
import { useLogout } from "../../hooks/use-auth.js";
import { useAuthStore } from "../../stores/auth-store.js";
import { useUIStore, type Theme } from "../../stores/ui-store.js";

// Port structurel de docs/legacy/nimbalodge-app/src/components/layout/Sidebar.jsx (marque, groupes de nav,
// toggle de thème) vers Tailwind + shadcn. Nav filtrée par permission réelle (RBAC backend, Phase
// 3) — un item sans `permission` (Tableau de bord) reste toujours visible.
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const logout = useLogout();

  const initials = user ? `${user.firstName.at(0) ?? ""}${user.lastName.at(0) ?? ""}`.toUpperCase() : "?";

  return (
    <div className="flex h-full flex-col bg-sidebar-bg text-sidebar-ink">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-bg-2 [&_svg]:size-5">
          <Icons.IconMark />
        </div>
        <div className="min-w-0">
          <div className="font-title text-sm font-[var(--fw-title)] leading-tight">NimbaLodge</div>
          <div className="truncate text-xs text-sidebar-ink-muted">ERP hôtelier</div>
        </div>
      </div>

      <div className="mx-4 mt-4 rounded-lg border border-dashed border-sidebar-border px-3 py-2.5 text-xs text-sidebar-ink-muted">
        {user?.hotel ? user.hotel.name : user ? `${user.organization.name} (tous hôtels)` : "…"}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, i) => {
          const items = group.items.filter((item) => !item.permission || hasPermission(item.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.label ?? i} className="mb-1">
              {group.label ? (
                <div className="mb-1 mt-4 px-2 text-[11px] font-[var(--fw-small-strong)] uppercase tracking-wide text-sidebar-ink-muted">
                  {group.label}
                </div>
              ) : null}
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-[var(--fw-subtitle)] text-sidebar-ink-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-ink [&_svg]:size-[18px]",
                      isActive && "bg-sidebar-active text-sidebar-ink"
                    )
                  }
                >
                  <item.icon />
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(value) => value && setTheme(value as Theme)}
          className="mb-3 w-full bg-sidebar-bg-2"
        >
          <ToggleGroupItem value="light" className="flex-1 text-sidebar-ink-muted data-[state=on]:bg-sidebar-active data-[state=on]:text-sidebar-ink">
            Clair
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="flex-1 text-sidebar-ink-muted data-[state=on]:bg-sidebar-active data-[state=on]:text-sidebar-ink">
            Sombre
          </ToggleGroupItem>
          <ToggleGroupItem value="auto" className="flex-1 text-sidebar-ink-muted data-[state=on]:bg-sidebar-active data-[state=on]:text-sidebar-ink">
            Auto
          </ToggleGroupItem>
        </ToggleGroup>

        <button
          type="button"
          onClick={() => logout.mutate()}
          className="flex w-full items-center gap-2.5 rounded-lg bg-sidebar-bg-2 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-active"
          title="Se déconnecter"
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-active text-xs font-[var(--fw-subtitle-strong)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate font-[var(--fw-subtitle-strong)] text-sidebar-ink">
              {user ? `${user.firstName} ${user.lastName}` : "…"}
            </div>
            <div className="truncate text-sidebar-ink-muted">{user?.email ?? ""}</div>
          </div>
          <LogOut className="size-4 opacity-60" />
        </button>
      </div>
    </div>
  );
}
