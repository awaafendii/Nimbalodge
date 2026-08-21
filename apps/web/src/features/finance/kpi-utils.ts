// Calcul de tendance partagé entre les dashboards de sous-module Finance (Recettes, Dépenses, ...).
// `higherIsBetter` découple la couleur (bon/mauvais) du signe de la variation : une dépense en
// hausse doit s'afficher en rouge même si la valeur affichée (la flèche) pointe vers le haut.
export function computeTrend(current: number, previous: number, higherIsBetter: boolean) {
  if (!previous) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  const isGood = higherIsBetter ? pct >= 0 : pct <= 0;
  return { value: pct, sentiment: isGood ? ("up" as const) : ("down" as const) };
}
