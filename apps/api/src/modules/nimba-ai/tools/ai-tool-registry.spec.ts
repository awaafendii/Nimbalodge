import type { AiRequestContext } from "../orchestrator/ai-orchestrator.service";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";
import { AiToolRegistry } from "./ai-tool-registry";
import type { AiTool } from "./ai-tool.interface";

// Unit — pièce la plus critique du système Nimba AI (voir plan d'architecture). Couvre de façon
// exhaustive : refus déterministe sans la permission requise, autorisation avec la permission
// présente, Tool inconnu, exigence de TOUTES les permissions déclarées (AND, pas OR), et le fait
// que listAvailable() ne filtre que par permission, jamais par autre critère caché.
describe("AiToolRegistry", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };

  function buildContext(permissions: string[]): AiRequestContext {
    return { user, permissions: new Set(permissions), departmentIds: [] };
  }

  function buildTool(overrides: Partial<AiTool> = {}): AiTool {
    return {
      name: "finance-summary",
      description: "Résumé financier",
      requiredPermissions: ["finance-summary.view"],
      parameters: { type: "object", properties: {}, required: [] },
      execute: jest.fn().mockResolvedValue({ total: 1000 }),
      ...overrides,
    };
  }

  it("refuse d'invoquer un Tool quand la permission requise est absente (403)", async () => {
    const tool = buildTool();
    const registry = new AiToolRegistry([tool]);
    const context = buildContext([]);

    await expect(registry.invoke("finance-summary", {}, context)).rejects.toThrow("Permissions insuffisantes");
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it("autorise l'invocation quand la permission requise est présente", async () => {
    const tool = buildTool();
    const registry = new AiToolRegistry([tool]);
    const context = buildContext(["finance-summary.view"]);

    const result = await registry.invoke("finance-summary", { month: 8 }, context);

    expect(result).toEqual({ total: 1000 });
    expect(tool.execute).toHaveBeenCalledWith({ month: 8 }, context);
  });

  it("rejette un Tool inconnu (404), sans jamais exécuter quoi que ce soit", async () => {
    const registry = new AiToolRegistry([buildTool()]);
    const context = buildContext(["finance-summary.view"]);

    await expect(registry.invoke("tool-inexistant", {}, context)).rejects.toThrow("Tool IA inconnu");
  });

  it("exige TOUTES les permissions déclarées (ET, jamais OU)", async () => {
    const tool = buildTool({ requiredPermissions: ["payslips.view", "employees.view"] });
    const registry = new AiToolRegistry([tool]);

    await expect(registry.invoke("finance-summary", {}, buildContext(["payslips.view"]))).rejects.toThrow(
      "Permissions insuffisantes"
    );
    expect(tool.execute).not.toHaveBeenCalled();

    await expect(
      registry.invoke("finance-summary", {}, buildContext(["payslips.view", "employees.view"]))
    ).resolves.toBeDefined();
  });

  it("reproduit l'exemple exact du brief : un responsable Restaurant sans payslips.view ne peut jamais invoquer le Tool salaires", async () => {
    const payrollTool = buildTool({
      name: "hr-payroll-summary",
      requiredPermissions: ["payslips.view"],
    });
    const registry = new AiToolRegistry([payrollTool]);
    // Contexte représentatif d'un responsable Restaurant : nimba-ai.use + permissions
    // opérationnelles de son département, mais jamais payslips.view.
    const restaurantManagerContext = buildContext(["nimba-ai.use", "finance-expenses.view"]);

    await expect(registry.invoke("hr-payroll-summary", {}, restaurantManagerContext)).rejects.toThrow(
      "Permissions insuffisantes"
    );
    expect(payrollTool.execute).not.toHaveBeenCalled();
  });

  it("listAvailable() ne retourne que les Tools dont la permission requise est déjà accordée", () => {
    const financeTool = buildTool({ name: "finance-summary", requiredPermissions: ["finance-summary.view"] });
    const payrollTool = buildTool({ name: "hr-payroll-summary", requiredPermissions: ["payslips.view"] });
    const registry = new AiToolRegistry([financeTool, payrollTool]);

    const available = registry.listAvailable(buildContext(["finance-summary.view"]));

    expect(available.map((tool) => tool.name)).toEqual(["finance-summary"]);
  });

  it("fonctionne sans aucun Tool enregistré (registre vide, comme à l'Étape 3 avant les premiers Tools)", async () => {
    const registry = new AiToolRegistry();
    await expect(registry.invoke("quoi-que-ce-soit", {}, buildContext(["nimba-ai.use"]))).rejects.toThrow(
      "Tool IA inconnu"
    );
    expect(registry.listAvailable(buildContext(["nimba-ai.use"]))).toEqual([]);
  });
});
