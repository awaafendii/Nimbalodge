import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../../../common/audit/audit.service";
import { DepartmentsService } from "../../departments/departments.service";
import { PermissionsService } from "../../permissions/permissions.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { AiToolRegistry } from "../tools/ai-tool-registry";

// Nimba AI — cœur du pipeline de sécurité (voir plan d'architecture Nimba AI, section "Pipeline de
// sécurité et de minimisation"). Résout UNE FOIS par requête les permissions réelles et le scope
// département du demandeur, avec les MÊMES primitives que PermissionsGuard/assertInDepartmentScope
// — jamais de logique de permission réimplémentée ici.
export interface AiRequestContext {
  user: AuthenticatedUser;
  permissions: Set<string>;
  departmentIds: string[];
}

@Injectable()
export class AiOrchestratorService {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly departmentsService: DepartmentsService,
    private readonly toolRegistry: AiToolRegistry,
    private readonly auditService: AuditService
  ) {}

  async resolveContext(user: AuthenticatedUser): Promise<AiRequestContext> {
    const [{ permissions }, departmentIds] = await Promise.all([
      this.permissionsService.resolveForUser(user.id),
      this.departmentsService.getDepartmentIds(user.id),
    ]);
    return { user, permissions, departmentIds };
  }

  // Point de passage unique vers un Tool — jamais d'appel direct à AiToolRegistry.invoke() depuis
  // ailleurs dans le code (contrôleur compris, à partir de l'Étape 4). Un refus (permission
  // manquante ou Tool inconnu) est journalisé dans AuditLog exactement comme AuthzAuditFilter le
  // fait pour un rejet 401/403 REST — "tenté-mais-refusé" doit rester visible dans /audit-logs.
  async invokeTool<TOutput = unknown>(name: string, input: unknown, user: AuthenticatedUser): Promise<TOutput> {
    const context = await this.resolveContext(user);
    try {
      return await this.toolRegistry.invoke<TOutput>(name, input, context);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        this.auditService.record({
          organizationId: user.organizationId,
          hotelId: user.hotelId,
          userId: user.id,
          method: "POST",
          path: `/nimba-ai/tools/${name}`,
          resourceType: "nimba-ai",
          action: "tool-denied",
          outcome: "FAILURE",
          errorMessage: error.message,
        });
      }
      throw error;
    }
  }
}
