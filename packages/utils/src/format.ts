// Port TypeScript de nimbalodge-app/src/utils/format.js — copie parallèle, pas un import partagé.
// Le prototype legacy garde son propre format.js indépendant.

export const FX = 9300; // 1 USD = 9300 GNF

export function fmtGNF(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/,/g, " ") + " GNF";
}

export function fmtUSD(n: number): string {
  return "$ " + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export type Currency = "GNF" | "USD";

export function money(gnf: number, currency: Currency): string {
  return currency === "USD" ? fmtUSD(gnf / FX) : fmtGNF(gnf);
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
