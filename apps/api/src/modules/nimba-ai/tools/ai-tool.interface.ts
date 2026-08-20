import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";

// Nimba AI — un Tool est le SEUL moyen pour l'orchestrateur (et, à partir de l'Étape 9, le
// function-calling du LLM) d'atteindre une donnée métier. `requiredPermissions` doit toujours être
// la/les permission(s) RÉELLE(S) qui gate(nt) déjà l'équivalent REST (ex. "payslips.view"), jamais
// une permission IA synthétique — voir le plan d'architecture Nimba AI. `execute()` ne fait jamais
// de mutation (voir AiToolRegistry, aucun Tool en écriture n'est jamais enregistré) et reçoit
// toujours le AiRequestContext déjà résolu — jamais de nouvel appel à PermissionsService/
// DepartmentsService à l'intérieur d'un Tool.
export interface AiTool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly requiredPermissions: string[];
  // JSON Schema exposé tel quel au function-calling du LLM (Étape 9, GeminiProvider le transmet
  // sans transformation — voir gemini.provider.spec.ts). Le LLM ne choisit jamais QUOI calculer,
  // seulement quel(s) Tool(s) interroger et avec quels paramètres — voir la séparation des
  // responsabilités du plan d'architecture Nimba AI.
  readonly parameters: Record<string, unknown>;
  execute(input: TInput, context: AiRequestContext): Promise<TOutput>;
}

// Token d'injection pour le multi-provider de Tools (pattern standard NestJS, même esprit que
// APP_GUARD/APP_INTERCEPTOR) — chaque module de Tool (Finance, Hospitality, Département, RH,
// Anomalies) s'enregistre ici au fil des étapes suivantes, jamais par mutation directe du registre.
export const AI_TOOLS = "AI_TOOLS";

// Schéma partagé par les Tools dont l'entrée est une plage de dates optionnelle (tous sauf
// finance-summary, qui utilise PERIOD_MONTH_PARAMETERS ci-dessous) — évite de dupliquer le même
// JSON Schema 5 fois.
export const PERIOD_RANGE_PARAMETERS: Record<string, unknown> = {
  type: "object",
  properties: {
    dateFrom: { type: "string", format: "date", description: "Date de début (AAAA-MM-JJ), optionnelle — mois courant par défaut." },
    dateTo: { type: "string", format: "date", description: "Date de fin (AAAA-MM-JJ), optionnelle — mois courant par défaut." },
  },
  required: [],
};

export const PERIOD_MONTH_PARAMETERS: Record<string, unknown> = {
  type: "object",
  properties: {
    month: { type: "integer", minimum: 1, maximum: 12, description: "Mois (1-12), optionnel — mois courant par défaut." },
    year: { type: "integer", minimum: 2000, description: "Année (ex. 2026), optionnelle — année courante par défaut." },
  },
  required: [],
};
