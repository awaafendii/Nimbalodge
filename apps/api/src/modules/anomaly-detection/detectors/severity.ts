import type { Prisma } from "@prisma/client";

import type { AnomalySeverity } from "../anomaly";

// Seuils partagés par tous les détecteurs à seuil relatif (jamais de logique dupliquée/différente
// d'un détecteur à l'autre pour la même notion de "à quel point c'est grave").
export function severityForRatio(ratio: number): AnomalySeverity {
  if (ratio >= 1) return "critical"; // observé ≥ 2× la référence
  if (ratio >= 0.5) return "high"; // observé ≥ 1.5× la référence
  if (ratio >= 0.2) return "medium"; // observé ≥ 1.2× la référence
  return "low";
}

export function fmtDecimal(value: Prisma.Decimal): string {
  return value.toString();
}
