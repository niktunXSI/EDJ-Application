// Restores the demo household to its seeded state (dates are relative to today).
// Usage: npm run db:reset   (uses DATABASE_URL when set, otherwise the local PGlite database)
import { closeDatabase, databaseKind, withTransaction } from "../src/lib/server/db";
import { resetDemoData } from "../src/lib/server/seed";

async function main() {
  await withTransaction((tx) => resetDemoData(tx));
  console.log(`Demo data reset (${databaseKind()}).`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
