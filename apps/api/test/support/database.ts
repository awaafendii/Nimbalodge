import { PrismaService } from "../../src/database/prisma.service";

// Réinitialise entièrement la base de test entre suites (TRUNCATE ... CASCADE) — chaque fichier
// e2e reconstruit ses propres données via fixtures.ts, jamais de partage d'état implicite entre
// suites. `_prisma_migrations` est exclue (métadonnée de schéma, pas une donnée métier).
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length === 0) {
    return;
  }
  const names = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE;`);
}
