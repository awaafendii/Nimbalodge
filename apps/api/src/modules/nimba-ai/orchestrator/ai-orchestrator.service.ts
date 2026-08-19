import { Injectable } from "@nestjs/common";

import { DepartmentsService } from "../../departments/departments.service";
import { PermissionsService } from "../../permissions/permissions.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

// Nimba AI — cœur du pipeline de sécurité (voir plan d'architecture Nimba AI, section "Pipeline de
// sécurité et de minimisation"). Résout UNE FOIS par requête les permissions réelles et le scope
// département du demandeur, avec les MÊMES primitives que PermissionsGuard/assertInDepartmentScope
// — jamais de logique de permission réimplémentée ici. Les étapes suivantes du plan (RBAC
// enforcement via AiToolRegistry, dispatch vers les Tools, minimisation, appel LLM) viennent
// s'ajouter à ce service au fil des prochaines étapes, pas réécrites depuis zéro.
export interface AiRequestContext {
  user: AuthenticatedUser;
  permissions: Set<string>;
  departmentIds: string[];
}

@Injectable()
export class AiOrchestratorService {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly departmentsService: DepartmentsService
  ) {}

  async resolveContext(user: AuthenticatedUser): Promise<AiRequestContext> {
    const [{ permissions }, departmentIds] = await Promise.all([
      this.permissionsService.resolveForUser(user.id),
      this.departmentsService.getDepartmentIds(user.id),
    ]);
    return { user, permissions, departmentIds };
  }
}
