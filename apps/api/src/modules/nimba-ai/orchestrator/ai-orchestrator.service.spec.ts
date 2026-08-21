import { ForbiddenException, NotFoundException } from "@nestjs/common";

import type { AuditService } from "../../../common/audit/audit.service";
import type { DepartmentsService } from "../../departments/departments.service";
import type { PermissionsService } from "../../permissions/permissions.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import type { AiToolRegistry } from "../tools/ai-tool-registry";
import { AiOrchestratorService } from "./ai-orchestrator.service";

// Unit — PermissionsService/DepartmentsService/AiToolRegistry/AuditService entièrement mockés.
// Vérifie que l'orchestrateur réutilise ces primitives telles quelles (jamais de logique de
// permission/scope réimplémentée), et que tout refus de Tool (permission manquante ou Tool
// inconnu) est journalisé dans AuditLog avant d'être propagé à l'appelant.
describe("AiOrchestratorService", () => {
  function buildService() {
    const permissionsService = { resolveForUser: jest.fn() };
    const departmentsService = { getDepartmentIds: jest.fn() };
    const toolRegistry = { invoke: jest.fn(), listAvailable: jest.fn(), hasPermission: jest.fn() };
    const auditService = { record: jest.fn() };
    const service = new AiOrchestratorService(
      permissionsService as unknown as PermissionsService,
      departmentsService as unknown as DepartmentsService,
      toolRegistry as unknown as AiToolRegistry,
      auditService as unknown as AuditService
    );
    return { service, permissionsService, departmentsService, toolRegistry, auditService };
  }

  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };

  describe("resolveContext", () => {
    it("résout le contexte à partir des mêmes primitives que le reste de l'app", async () => {
      const { service, permissionsService, departmentsService } = buildService();
      const permissions = new Set(["finance-summary.view", "nimba-ai.use"]);
      permissionsService.resolveForUser.mockResolvedValue({ roleNames: ["HOTEL_ADMIN"], permissions });
      departmentsService.getDepartmentIds.mockResolvedValue(["dept-1"]);

      const context = await service.resolveContext(user);

      expect(permissionsService.resolveForUser).toHaveBeenCalledWith(user.id, user.hotelId);
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

  describe("invokeTool", () => {
    function stubContext(permissionsService: { resolveForUser: jest.Mock }, departmentsService: { getDepartmentIds: jest.Mock }) {
      permissionsService.resolveForUser.mockResolvedValue({ roleNames: [], permissions: new Set(["nimba-ai.use"]) });
      departmentsService.getDepartmentIds.mockResolvedValue([]);
    }

    it("délègue au AiToolRegistry avec le contexte résolu et renvoie son résultat", async () => {
      const { service, permissionsService, departmentsService, toolRegistry } = buildService();
      stubContext(permissionsService, departmentsService);
      toolRegistry.invoke.mockResolvedValue({ total: 1000 });

      const result = await service.invokeTool("finance-summary", { month: 8 }, user);

      expect(result).toEqual({ total: 1000 });
      expect(toolRegistry.invoke).toHaveBeenCalledWith(
        "finance-summary",
        { month: 8 },
        expect.objectContaining({ user })
      );
    });

    it("journalise un refus de permission dans AuditLog puis propage l'erreur (jamais silencieux)", async () => {
      const { service, permissionsService, departmentsService, toolRegistry, auditService } = buildService();
      stubContext(permissionsService, departmentsService);
      toolRegistry.invoke.mockRejectedValue(new ForbiddenException('Permissions insuffisantes pour le tool "hr-payroll-summary"'));

      await expect(service.invokeTool("hr-payroll-summary", {}, user)).rejects.toThrow(ForbiddenException);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          organizationId: user.organizationId,
          hotelId: user.hotelId,
          resourceType: "nimba-ai",
          action: "tool-denied",
          outcome: "FAILURE",
        })
      );
    });

    it("journalise aussi un Tool inconnu (404) comme tentative refusée", async () => {
      const { service, permissionsService, departmentsService, toolRegistry, auditService } = buildService();
      stubContext(permissionsService, departmentsService);
      toolRegistry.invoke.mockRejectedValue(new NotFoundException("Tool IA inconnu : tool-fantome"));

      await expect(service.invokeTool("tool-fantome", {}, user)).rejects.toThrow(NotFoundException);
      expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "tool-denied" }));
    });

    it("n'écrit rien dans AuditLog quand le Tool réussit (le succès n'est pas un refus)", async () => {
      const { service, permissionsService, departmentsService, toolRegistry, auditService } = buildService();
      stubContext(permissionsService, departmentsService);
      toolRegistry.invoke.mockResolvedValue({ ok: true });

      await service.invokeTool("finance-summary", {}, user);

      expect(auditService.record).not.toHaveBeenCalled();
    });
  });
});
