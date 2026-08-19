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
  execute(input: TInput, context: AiRequestContext): Promise<TOutput>;
}

// Token d'injection pour le multi-provider de Tools (pattern standard NestJS, même esprit que
// APP_GUARD/APP_INTERCEPTOR) — chaque module de Tool (Finance, Hospitality, Département, RH,
// Anomalies) s'enregistre ici au fil des étapes suivantes, jamais par mutation directe du registre.
export const AI_TOOLS = "AI_TOOLS";
