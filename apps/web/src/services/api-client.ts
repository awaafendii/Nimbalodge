import { useAuthStore } from "../stores/auth-store.js";

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message) && message.every((entry) => typeof entry === "string")) {
      return message.join(", ");
    }
  }
  return fallback;
}

// Un seul refresh en vol à la fois, partagé entre requêtes concurrentes — évite une rafale de
// POST /auth/refresh si plusieurs requêtes essuient un 401 simultanément.
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();
  if (!refreshToken) {
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) {
          clearAuth();
          return false;
        }
        const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
        setTokens(tokens);
        return true;
      } catch {
        clearAuth();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  // /auth/login et /auth/refresh eux-mêmes ne doivent jamais déclencher une tentative de refresh
  // (un 401 sur /auth/refresh signifie déjà "session expirée", pas "il faut la rafraîchir").
  skipAuthRefresh?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, skipAuthRefresh, headers, ...rest } = options;

  const doFetch = (): Promise<Response> => {
    const token = useAuthStore.getState().accessToken;
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response: Response;
  try {
    response = await doFetch();
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur — vérifiez votre connexion.");
  }

  if (response.status === 401 && !skipAuthRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      try {
        response = await doFetch();
      } catch {
        throw new ApiError(0, "Impossible de joindre le serveur — vérifiez votre connexion.");
      }
    }
  }

  if (!response.ok) {
    let parsedBody: unknown;
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = undefined;
    }
    throw new ApiError(response.status, extractMessage(parsedBody, response.statusText), parsedBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// Pour les réponses binaires (export CSV/Excel/PDF, voir ReportsController) — apiFetch() suppose
// toujours du JSON. Même logique d'auth/refresh que apiFetch, jamais dupliquée ailleurs.
export async function apiFetchBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const doFetch = (): Promise<Response> => {
    const token = useAuthStore.getState().accessToken;
    return fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  let response: Response;
  try {
    response = await doFetch();
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur — vérifiez votre connexion.");
  }

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      try {
        response = await doFetch();
      } catch {
        throw new ApiError(0, "Impossible de joindre le serveur — vérifiez votre connexion.");
      }
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return { blob, filename: match?.[1] ?? "export" };
}

export const apiClient = {
  get: <T>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  getBlob: (path: string) => apiFetchBlob(path),
};
