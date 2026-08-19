// Nimba AI — chaque réponse (insight/anomalie/chat) doit exposer d'où vient la donnée qu'elle
// affiche : le LLM ne doit jamais être présenté comme la source de vérité d'un chiffre (voir le
// tableau de séparation des responsabilités du plan d'architecture Nimba AI). Un Tool construit
// une Provenance à chaque appel à un service métier qu'il consulte.
export interface Provenance {
  module: string; // ex. "Finance → Dépenses → Restaurant"
  period?: { from: string; to: string };
  filters?: Record<string, string>;
}

export function buildProvenance(
  module: string,
  options?: { period?: { from: string; to: string }; filters?: Record<string, string> }
): Provenance {
  return {
    module,
    ...(options?.period ? { period: options.period } : {}),
    ...(options?.filters ? { filters: options.filters } : {}),
  };
}
