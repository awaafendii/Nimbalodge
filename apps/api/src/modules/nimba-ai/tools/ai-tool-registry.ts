import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";

import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import { AI_TOOLS, type AiTool } from "./ai-tool.interface";

// Nimba AI — pièce la plus critique du système (voir plan d'architecture Nimba AI, Étape 3).
// Refus déterministe, codé en dur, AVANT tout accès donnée : ni le LLM ni un appelant ne peuvent
// jamais invoquer un Tool sans que sa/ses permission(s) requise(s) soit(ent) présente(s) dans le
// contexte déjà résolu par AiOrchestratorService.resolveContext(). Registre lui-même sans effet de
// bord (pas d'écriture d'audit ici — c'est la responsabilité de l'appelant, voir
// AiOrchestratorService, pour garder ce registre pur et facile à tester de façon exhaustive).
@Injectable()
export class AiToolRegistry {
  private readonly tools: Map<string, AiTool>;

  constructor(@Optional() @Inject(AI_TOOLS) tools: AiTool[] = []) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  hasPermission(context: AiRequestContext, tool: AiTool): boolean {
    return tool.requiredPermissions.every((key) => context.permissions.has(key));
  }

  // Utilisé par le function-calling du LLM (Étape 9) pour ne jamais même proposer un Tool que le
  // demandeur ne pourrait pas invoquer — la vérification à l'invocation ci-dessous reste la
  // garantie réelle, celle-ci n'est qu'une commodité UX/prompt.
  listAvailable(context: AiRequestContext): AiTool[] {
    return [...this.tools.values()].filter((tool) => this.hasPermission(context, tool));
  }

  async invoke<TOutput = unknown>(name: string, input: unknown, context: AiRequestContext): Promise<TOutput> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new NotFoundException(`Tool IA inconnu : ${name}`);
    }
    if (!this.hasPermission(context, tool)) {
      throw new ForbiddenException(`Permissions insuffisantes pour le tool "${name}"`);
    }
    return tool.execute(input, context) as Promise<TOutput>;
  }
}
