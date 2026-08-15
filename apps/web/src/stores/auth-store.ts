import { create } from "zustand";
import { persist } from "zustand/middleware";

// Reflète GET /auth/me (apps/api/src/modules/auth/auth.service.ts, resolveMe()) — aucune donnée
// fictive ici, uniquement la forme de la réponse réelle de l'API.
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organization: { id: string; name: string };
  hotel: { id: string; name: string } | null;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
  hasPermission: (key: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (tokens) => set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
      // SUPER_ADMIN comme n'importe quel autre rôle : aucun bypass client-side — la permission doit
      // être explicitement présente dans la liste résolue par le backend (RBAC réel, pas simulé).
      hasPermission: (key) => get().user?.permissions.includes(key) ?? false,
    }),
    {
      name: "nimbalodge:web:auth",
    }
  )
);
