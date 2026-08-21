import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, CardTitle, Icons, Input, Label } from "@nimbalodge/ui";

import { useConfirmPasswordReset } from "../../hooks/use-auth.js";
import { ApiError } from "../../services/api-client.js";

// Le token vient exclusivement de l'URL (lien envoyé par email, voir PasswordResetService) —
// jamais saisi à la main, jamais stocké ailleurs que dans cette query string éphémère.
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState(false);
  const confirmReset = useConfirmPasswordReset();

  if (!token) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <CardTitle>Lien invalide</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ce lien de réinitialisation est incomplet ou a expiré. Demandez-en un nouveau.
            </p>
          </CardHeader>
          <CardContent>
            <Link to="/forgot-password">
              <Button className="w-full">Demander un nouveau lien</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMismatchError(true);
      return;
    }
    setMismatchError(false);
    confirmReset.mutate({ token: token!, newPassword });
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-secondary [&_svg]:size-5">
            <Icons.IconMark />
          </div>
          <CardTitle>Nouveau mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {mismatchError ? <p className="text-sm text-destructive">Les mots de passe ne correspondent pas.</p> : null}
            {confirmReset.isError ? (
              <p className="text-sm text-destructive">
                {confirmReset.error instanceof ApiError ? confirmReset.error.message : "Erreur inattendue."}
              </p>
            ) : null}
            <Button type="submit" disabled={confirmReset.isPending} className="mt-1">
              {confirmReset.isPending ? "Enregistrement…" : "Réinitialiser le mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
