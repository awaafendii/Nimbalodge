import { INestApplication } from "@nestjs/common";

import { resetDatabase } from "./support/database";
import { createTenant, seedPermissionCatalog } from "./support/fixtures";
import { authed, loginAndGetToken } from "./support/http";
import { createTestApp } from "./support/test-app";
import { PrismaService } from "../src/database/prisma.service";

// AuditInterceptor écrit en best-effort, sans jamais bloquer la réponse HTTP réelle qu'il journalise
// (voir audit.service.ts) : un test qui enchaîne "mutation" puis "lecture immédiate du journal"
// peut légitimement gagner la course contre cette écriture asynchrone. On sonde donc au lieu de lire
// une seule fois, plutôt que d'introduire un délai fixe arbitraire.
async function waitForAuditEntry(
  client: ReturnType<typeof authed>,
  query: string,
  resourceId: string
): Promise<{ id: string; resourceId: string }> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await client.get(`/api/v1/audit-logs?${query}`).expect(200);
    const found = (response.body.items as { id: string; resourceId: string }[]).find(
      (item) => item.resourceId === resourceId
    );
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Entrée d'audit pour resourceId=${resourceId} jamais apparue (délai dépassé)`);
}

// Étape 7 (durcissement, Priority 7) — vérifie AuditLogsService/Controller après l'ajout de la
// pagination serveur, du filtre de recherche, et de l'endpoint de détail before/after (voir
// audit-logs.service.ts). Génère ses propres entrées d'audit via de vraies mutations (create/update
// de départements) plutôt que d'insérer directement en base — cohérent avec le principe du projet
// de tester le comportement réel de bout en bout.
describe("Journal d'audit — liste paginée et détail", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedPermissionCatalog(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejette une requête sans la permission audit-logs.view", async () => {
    const tenant = await createTenant(prisma, "audit-logs-no-perm", ["departments.view"]);
    const token = await loginAndGetToken(app, tenant.email, tenant.password);

    await authed(app, token).get("/api/v1/audit-logs").expect(403);
  });

  it("pagine, filtre par action/recherche, et expose before/after via le détail", async () => {
    const tenant = await createTenant(prisma, "audit-logs-org");
    const token = await loginAndGetToken(app, tenant.email, tenant.password);
    const client = authed(app, token);

    // Génère 3 créations + 1 mise à jour = 4 entrées d'audit mutantes (le login n'est pas audité par
    // AuditInterceptor, voir son commentaire de tête de fichier).
    const dept1 = await client.post("/api/v1/departments").send({ name: "Réception" }).expect(201);
    await client.post("/api/v1/departments").send({ name: "Housekeeping" }).expect(201);
    await client.post("/api/v1/departments").send({ name: "Maintenance" }).expect(201);
    await client
      .patch(`/api/v1/departments/${dept1.body.id}`)
      .send({ name: "Réception & Accueil" })
      .expect(200);

    // Attend que les 4 écritures d'audit best-effort soient bien visibles avant d'asserter sur la
    // pagination — voir waitForAuditEntry ci-dessus pour le raisonnement.
    await waitForAuditEntry(client, "action=update", dept1.body.id);

    const page1 = await client.get("/api/v1/audit-logs?pageSize=2&page=1").expect(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.total).toBeGreaterThanOrEqual(4);
    expect(page1.body.pageSize).toBe(2);
    expect(page1.body.pageCount).toBeGreaterThanOrEqual(2);

    const page2 = await client.get("/api/v1/audit-logs?pageSize=2&page=2").expect(200);
    expect(page2.body.items).toHaveLength(2);
    const page1Ids = new Set(page1.body.items.map((item: { id: string }) => item.id));
    for (const item of page2.body.items as { id: string }[]) {
      expect(page1Ids.has(item.id)).toBe(false);
    }

    const byAction = await client.get("/api/v1/audit-logs?action=update").expect(200);
    expect(byAction.body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of byAction.body.items as { action: string }[]) {
      expect(item.action).toBe("update");
    }

    const bySearch = await client.get("/api/v1/audit-logs?search=departments").expect(200);
    expect(bySearch.body.items.length).toBeGreaterThanOrEqual(4);

    const updateEntry = (byAction.body.items as { id: string; resourceId: string }[]).find(
      (item) => item.resourceId === dept1.body.id
    );
    expect(updateEntry).toBeDefined();

    const detail = await client.get(`/api/v1/audit-logs/${updateEntry?.id}`).expect(200);
    expect(detail.body.before).toEqual(expect.objectContaining({ name: "Réception" }));
    expect(detail.body.after).toEqual(expect.objectContaining({ name: "Réception & Accueil" }));
  });

  it("isole le journal d'audit entre organisations (liste et détail)", async () => {
    const tenantA = await createTenant(prisma, "audit-logs-tenant-a");
    const tokenA = await loginAndGetToken(app, tenantA.email, tenantA.password);
    const clientA = authed(app, tokenA);
    const created = await clientA.post("/api/v1/departments").send({ name: "Dépt Org A" }).expect(201);

    const auditEntry = await waitForAuditEntry(clientA, "search=departments", created.body.id);

    const tenantB = await createTenant(prisma, "audit-logs-tenant-b");
    const tokenB = await loginAndGetToken(app, tenantB.email, tenantB.password);

    const listB = await authed(app, tokenB).get("/api/v1/audit-logs").expect(200);
    expect((listB.body.items as { id: string }[]).some((item) => item.id === auditEntry.id)).toBe(false);

    await authed(app, tokenB).get(`/api/v1/audit-logs/${auditEntry.id}`).expect(403);
  });
});
