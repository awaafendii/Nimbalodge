// Crée la base de test (si absente) et y applique les migrations Prisma. Réutilise le même
// serveur Postgres local que le dev (`npm run db:up`) — juste une base séparée, jamais partagée
// avec les données de dev/démo. Invoqué via `npm run db:test:setup` (dotenv -e .env.test injecte
// DATABASE_URL avant que ce script ne s'exécute).
const { execSync } = require("child_process");

const testUrl = process.env.DATABASE_URL;
if (!testUrl) {
  console.error("DATABASE_URL manquant — lancer via `npm run db:test:setup` (charge .env.test).");
  process.exit(1);
}

const dbName = new URL(testUrl).pathname.replace(/^\//, "");
const adminUrl = testUrl.replace(`/${dbName}`, "/postgres");

try {
  execSync(`npx prisma db execute --url "${adminUrl}" --stdin`, {
    input: `CREATE DATABASE "${dbName}";`,
    stdio: ["pipe", "inherit", "pipe"],
  });
  console.log(`Base de test "${dbName}" créée.`);
} catch (error) {
  const stderr = error.stderr ? error.stderr.toString() : String(error.message ?? error);
  if (stderr.includes("already exists") || stderr.includes("42P04")) {
    console.log(`Base de test "${dbName}" déjà existante.`);
  } else {
    console.error(stderr);
    process.exit(1);
  }
}

execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
console.log("Migrations appliquées sur la base de test.");
