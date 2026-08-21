import { readFileSync } from "node:fs";
import { join } from "node:path";

// RBAC multi-hôtel × Nimba AI (Phase 12) — garde de régression statique pour le point 10 du plan
// de tests sécurité : aucun Tool ni Minimizer ne doit jamais accéder à Prisma directement. Le seul
// chemin vers une donnée métier doit rester Tool.execute() → service métier déjà scopé
// (FinanceSummaryService, ReportsService, HrInsightsService, ...), qui applique lui-même
// hotelId/organizationId/departmentId — jamais une requête Prisma réimplémentée ici qui
// contournerait ce scope. `usage/ai-usage.service.ts` est volontairement exclu : il écrit dans
// AiUsageLog (télémétrie latence/tokens/coût), pas dans une table de donnée métier.
const GUARDED_DIRS = ["tools", "context", "orchestrator", "chat"];
const FORBIDDEN_TOKEN = "PrismaService";

function listTsFiles(dir: string): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listTsFiles(fullPath));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Nimba AI — invariant de sécurité : aucun accès Prisma direct hors du service Usage", () => {
  it.each(GUARDED_DIRS)("%s/ ne contient aucun import PrismaService", (dir) => {
    const files = listTsFiles(join(__dirname, dir));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      expect(content.includes(FORBIDDEN_TOKEN)).toBe(false);
    }
  });
});
