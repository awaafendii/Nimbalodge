import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import * as authService from "../services/auth.js";
import { useAuthStore } from "../stores/auth-store.js";

// enabled: Boolean(accessToken) — jamais appelé tant qu'on n'a pas de token, évite un 401 inutile
// au premier rendu d'un visiteur non connecté.
export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const user = await authService.getMe();
      setUser(user);
      return user;
    },
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authService.login(email, password),
    onSuccess: async (tokens) => {
      setTokens(tokens);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/dashboard", { replace: true });
    },
  });
}

export function useLogout() {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await authService.logout(refreshToken).catch(() => undefined);
      }
    },
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}
