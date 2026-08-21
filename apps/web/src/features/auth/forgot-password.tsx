import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, CardTitle, Icons, Input, Label } from "@nimbalodge/ui";

import { useRequestPasswordReset } from "../../hooks/use-auth.js";

// Réponse toujours générique ("si un compte existe...") qu'un compte existe ou non pour cet email
// — reflète exactement le comportement anti-énumération du backend (PasswordResetService), jamais
// contredit côté frontend par un message différent selon le cas.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const requestReset = useRequestPasswordReset();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    requestReset.mutate(email);
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-secondary [&_svg]:size-5">
            <Icons.IconMark />
          </div>
          <CardTitle>Mot de passe oublié</CardTitle>
          <p className="text-sm text-muted-foreground">
            Indiquez votre email, nous vous envoyons un lien de réinitialisation.
          </p>
        </CardHeader>
        <CardContent>
          {requestReset.isSuccess ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé — valable 30
                minutes.
              </p>
              <Link to="/login" className="text-sm font-medium text-primary hover:underline">
                Retour à la connexion
              </Link>
            </div>
          ) : (
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
              {requestReset.isError ? (
                <p className="text-sm text-destructive">Une erreur est survenue. Réessayez dans un instant.</p>
              ) : null}
              <Button type="submit" disabled={requestReset.isPending} className="mt-1">
                {requestReset.isPending ? "Envoi…" : "Envoyer le lien"}
              </Button>
              <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
                Retour à la connexion
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
