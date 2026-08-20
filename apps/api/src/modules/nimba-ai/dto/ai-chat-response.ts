import type { Provenance } from "../context/provenance";

// Résultat structuré d'UN Tool invoqué pendant la conversation — `data` est toujours ce que le Tool
// a réellement calculé (jamais reformulé/altéré par le LLM), pour que le frontend puisse afficher
// les chiffres sources à côté de `answer` (voir le plan d'architecture Nimba AI, "Sources /
// provenance" : le chat ne doit jamais montrer uniquement une réponse générée par le LLM quand des
// chiffres sont impliqués).
export interface AiChatToolResult {
  tool: string;
  data: unknown;
}

export interface AiChatResponse {
  // Absent si le fournisseur IA n'est pas configuré, en échec, ou si la boucle d'appels d'outils a
  // atteint sa limite sans réponse finale — jamais un texte fabriqué à la place.
  answer?: string;
  provenance: Provenance[];
  toolResults: AiChatToolResult[];
  disclaimer?: string;
}
