import { apiFetch } from "./api-client.js";
import type { AuthUser } from "../stores/auth-store.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function login(email: string, password: string): Promise<AuthTokens> {
  return apiFetch<AuthTokens>("/auth/login", { method: "POST", body: { email, password }, skipAuthRefresh: true });
}

export function logout(refreshToken: string): Promise<{ success: true }> {
  return apiFetch("/auth/logout", { method: "POST", body: { refreshToken }, skipAuthRefresh: true });
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me", { method: "GET" });
}
