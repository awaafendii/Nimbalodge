import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, CardTitle, Icons, Input, Label } from "@nimbalodge/ui";

import { useLogin } from "../../hooks/use-auth.js";
import { ApiError } from "../../services/api-client.js";
import { useAuthStore } from "../../stores/auth-store.js";

// Aucun compte ni mot de passe en dur ici — le formulaire soumet à POST /auth/login (Phase 3),
// les seuls comptes existants sont ceux créés via prisma/seed.ts (dev) ou par un vrai workflow
// d'onboarding, jamais fabriqués côté frontend.
export default function LoginPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation() as { state?: { from?: { pathname?: string }; passwordResetSuccess?: boolean } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  if (accessToken) {
    return <Navigate to={location.state?.from?.pathname ?? "/dashboard"} replace />;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-secondary [&_svg]:size-5">
            <Icons.IconMark />
          </div>
          <CardTitle>NimbaLodge</CardTitle>
          <p className="text-sm text-muted-foreground">Connexion à votre espace ERP</p>
        </CardHeader>
        <CardContent>
          {location.state?.passwordResetSuccess ? (
            <p className="mb-4 rounded-md bg-good-soft px-3 py-2 text-center text-sm text-good">
              Mot de passe réinitialisé — connectez-vous avec votre nouveau mot de passe.
            </p>
          ) : null}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {login.isError ? (
              <p className="text-sm text-destructive">
                {login.error instanceof ApiError ? login.error.message : "Erreur de connexion."}
              </p>
            ) : null}
            <Button type="submit" disabled={login.isPending} className="mt-1">
              {login.isPending ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
