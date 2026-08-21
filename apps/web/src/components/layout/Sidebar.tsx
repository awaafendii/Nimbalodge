import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icons, ToggleGroup, ToggleGroupItem, cn } from "@nimbalodge/ui";

import { NAV_GROUPS, type NavItem, type NavSubItem } from "./nav-config.js";
import { useLogout } from "../../hooks/use-auth.js";
import { useAuthStore } from "../../stores/auth-store.js";
import { useUIStore, type Theme } from "../../stores/ui-store.js";

// Module avec sous-modules (ex. Finance) : ligne parent repliable — la flèche déplie/replie la
// liste des sous-modules, indépendamment du clic sur le libellé qui navigue vers le tableau de
// bord du module lui-même (`item.to`, désormais une vraie page, pas juste une redirection — voir
// finance/overview-page.tsx). Auto-déplié dès qu'on est déjà sur une de ses sous-routes, pour ne
// jamais masquer l'onglet actif.
function NavParentItem({
  item,
  visibleChildren,
  onNavigate,
}: {
  item: NavItem;
  visibleChildren: NavSubItem[];
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const isChildActive = visibleChildren.some(
    (child) => location.pathname === child.to || location.pathname.startsWith(`${child.to}/`)
  );
  const [expanded, setExpanded] = useState(isChildActive);
  useEffect(() => {
    if (isChildActive) setExpanded(true);
  }, [isChildActive]);

  return (
    <div>
      <div className="flex items-center gap-1">
        <NavLink
          to={item.to}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-[var(--fw-subtitle)] text-sidebar-ink-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-ink [&_svg]:size-[18px]",
              isActive && "bg-sidebar-active text-sidebar-ink"
            )
          }
        >
          <item.icon />
          {item.label}
        </NavLink>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? `Réduire ${item.label}` : `Développer ${item.label}`}
          className="flex size-7 flex-none items-center justify-center rounded-md text-sidebar-ink-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-ink [&_svg]:size-[15px]"
        >
          <Icons.IconChevronDown className={cn("transition-transform", !expanded && "-rotate-90")} />
        </button>
      </div>
      {expanded ? (
        <div className="ml-4 flex flex-col border-l border-sidebar-border pl-3">
          {visibleChildren.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm text-sidebar-ink-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-ink",
                  isActive && "bg-sidebar-active text-sidebar-ink"
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
          // Un module avec sous-modules (ex. Finance) reste visible dès qu'au moins un enfant est
          // autorisé, même sans permission propre sur le parent — voir nav-config.tsx.
          const items = group.items.filter((item) => {
            const visibleChildren = item.children?.filter((child) => !child.permission || hasPermission(child.permission));
            if (item.children) return (visibleChildren?.length ?? 0) > 0;
            return !item.permission || hasPermission(item.permission);
          });
          if (items.length === 0) return null;
          return (
            <div key={group.label ?? i} className="mb-1">
              {group.label ? (
                <div className="mb-1 mt-4 px-2 text-[11px] font-[var(--fw-small-strong)] uppercase tracking-wide text-sidebar-ink-muted">
                  {group.label}
                </div>
              ) : null}
              {items.map((item) => {
                const visibleChildren = item.children?.filter((child) => !child.permission || hasPermission(child.permission));
                if (visibleChildren && visibleChildren.length > 0) {
                  return <NavParentItem key={item.to} item={item} visibleChildren={visibleChildren} onNavigate={onNavigate} />;
                }
                return (
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
                );
              })}
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
