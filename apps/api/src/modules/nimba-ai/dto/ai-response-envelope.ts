import type { Provenance } from "../context/provenance";

// Forme de réponse commune à insights/anomalies/chat. `data` est toujours calculé par un service
// métier (jamais par le LLM, voir la séparation des responsabilités du plan Nimba AI) ; `answer`
// est un habillage optionnel en langage naturel, absent si aucun LLM n'est configuré ou en échec —
// jamais un substitut de `data` quand des chiffres sont impliqués.
export interface AiResponseEnvelope<TData> {
  data: TData;
  provenance: Provenance[];
  answer?: string;
  disclaimer?: string;
}
