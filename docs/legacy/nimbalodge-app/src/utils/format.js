export const FX = 9300; // 1 USD = 9300 GNF

export function fmtGNF(n) {
  return Math.round(n).toLocaleString("fr-FR").replace(/,/g, " ") + " GNF";
}

export function fmtUSD(n) {
  return "$ " + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function money(gnf, currency) {
  return currency === "USD" ? fmtUSD(gnf / FX) : fmtGNF(gnf);
}

export function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
