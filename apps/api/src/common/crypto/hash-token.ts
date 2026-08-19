import { createHash } from "node:crypto";

// Extrait de auth.service.ts (Étape 3) — même pattern réutilisé par tout secret à usage unique
// stocké en base (refresh token, lien de reset, code de récupération 2FA) : jamais la valeur
// brute, toujours son hash SHA-256. Un hash suffit ici (pas bcrypt) : ces valeurs sont des chaînes
// aléatoires à haute entropie générées côté serveur, pas des mots de passe choisis par un humain
// — pas besoin de ralentir le hachage contre une attaque par dictionnaire.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
