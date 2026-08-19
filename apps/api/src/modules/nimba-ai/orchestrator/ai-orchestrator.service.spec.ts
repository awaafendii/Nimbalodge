import type { DepartmentsService } from "../../departments/departments.service";
import type { PermissionsService } from "../../permissions/permissions.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { AiOrchestratorService } from "./ai-orchestrator.service";

// Unit — PermissionsService/DepartmentsService entièrement mockés. Vérifie que l'orchestrateur
// réutilise ces deux services tels quels (mêmes primitives que PermissionsGuard/
// assertInDepartmentScope) plutôt que de réimplémenter sa propre résolution de permission/scope.
describe("AiOrchestratorService", () => {
  function buildService() {
    const permissionsService = { resolveForUser: jest.fn() };
    const departmentsService = { getDepartmentIds: jest.fn() };
    const service = new AiOrchestratorService(
      permissionsService as unknown as PermissionsService,
      departmentsService as unknown as DepartmentsService
    );
    return { service, permissionsService, departmentsService };
  }

  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };

  it("résout le contexte à partir des mêmes primitives que le reste de l'app", async () => {
    const { service, permissionsService, departmentsService } = buildService();
    const permissions = new Set(["finance-summary.view", "nimba-ai.use"]);
    permissionsService.resolveForUser.mockResolvedValue({ roleNames: ["HOTEL_ADMIN"], permissions });
    departmentsService.getDepartmentIds.mockResolvedValue(["dept-1"]);

    const context = await service.resolveContext(user);

    expect(permissionsService.resolveForUser).toHaveBeenCalledWith(user.id);
    expect(departmentsService.getDepartmentIds).toHaveBeenCalledWith(user.id);
    expect(context).toEqual({ user, permissions, departmentIds: ["dept-1"] });
  });

  it("renvoie un tableau de départements vide pour un demandeur sans affectation (pas de régression)", async () => {
    const { service, permissionsService, departmentsService } = buildService();
    permissionsService.resolveForUser.mockResolvedValue({ roleNames: [], permissions: new Set<string>() });
    departmentsService.getDepartmentIds.mockResolvedValue([]);

    const context = await service.resolveContext(user);

    expect(context.departmentIds).toEqual([]);
    expect(context.permissions.size).toBe(0);
  });
});
