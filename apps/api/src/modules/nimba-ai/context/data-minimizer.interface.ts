// Nimba AI — étape obligatoire du pipeline avant toute mise en contexte LLM (voir "DATA
// MINIMIZATION" dans le plan d'architecture Nimba AI). Un DataMinimizer par Tool, pas une passe
// générique de redaction par nom de clé : le risque n'est pas un mot-clé sensible isolé, c'est une
// liste d'individus entière (ex. masse salariale → total agrégé uniquement, jamais noms/emails/
// matricules, même si le Tool sous-jacent les avait en mémoire pour calculer le total).
export interface DataMinimizer<TRaw, TMinimized> {
  minimize(raw: TRaw): TMinimized;
}
