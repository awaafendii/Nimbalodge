import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icons,
  cn,
} from "@nimbalodge/ui";

import { useSwitchHotel } from "../../hooks/use-auth.js";
import { usePermission } from "../../hooks/use-permission.js";
import { useAuthStore } from "../../stores/auth-store.js";

// Sélecteur d'établissement (header, §3/§24) — n'affiche que les hôtels où l'utilisateur a une
// HotelMembership réelle (`user.hotels`, voir GET /auth/me) : jamais un hotelId choisi librement
// côté client, le backend revalide toujours (AuthService.switchHotel). Masqué si rien à
// sélectionner (0 ou 1 hôtel) — un utilisateur mono-hôtel n'a pas besoin de ce contrôle, son hôtel
// est déjà visible dans la Sidebar/le Topbar.
export function HotelSwitcher() {
  const user = useAuthStore((s) => s.user);
  const switchHotel = useSwitchHotel();
  const canCreateHotel = usePermission("hotels.create");
  const canViewHotels = usePermission("hotels.view");

  // `user.hotels` peut être absent pour une session persistée (localStorage) datant d'avant
  // l'ajout de ce champ à /auth/me — repli défensif plutôt qu'un crash, le prochain
  // GET /auth/me (staleTime 5 min, ou après un refresh) revient avec la forme à jour.
  const hotels = user?.hotels ?? [];
  if (!user || hotels.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={switchHotel.isPending}
          className="max-w-[220px] justify-start gap-2"
        >
          <Icons.IconBuilding className="size-4 flex-none" />
          <span className="truncate">{user.hotel?.name ?? "Sélectionner un établissement"}</span>
          <Icons.IconChevronDown className="size-3.5 flex-none opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Mes établissements</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hotels.map((h) => {
          const isActive = h.id === user.hotel?.id;
          return (
            <DropdownMenuItem
              key={h.id}
              disabled={switchHotel.isPending}
              onSelect={() => {
                if (!isActive) switchHotel.mutate(h.id);
              }}
              className={cn("flex items-center justify-between gap-3", isActive && "font-[var(--fw-subtitle-strong)]")}
            >
              <span className="flex items-center gap-2 truncate">
                {isActive ? <Check className="size-3.5 flex-none text-primary" /> : <span className="size-3.5 flex-none" />}
                <span className="truncate">{h.name}</span>
              </span>
              <span className="flex-none text-xs text-muted-foreground">{h.role}</span>
            </DropdownMenuItem>
          );
        })}
        {canCreateHotel || canViewHotels ? (
          <>
            <DropdownMenuSeparator />
            {canCreateHotel ? (
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Icons.IconPlus className="mr-2 size-4" />
                  Ajouter un établissement
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link to="/settings">Voir tous les établissements</Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
