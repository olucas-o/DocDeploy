import dataSource from "./data-source.js";

async function run(): Promise<void> {
  if (!process.env.MIGRATIONS_DATABASE_URL) throw new Error("MIGRATIONS_DATABASE_URL is required");
  await dataSource.initialize();
  try {
    await dataSource.runMigrations({ transaction: "all" });
  } finally {
    await dataSource.destroy();
  }
}

void run();
