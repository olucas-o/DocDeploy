import * as argon2 from "argon2";

import dataSource from "./data-source.js";

const permissions = [
  "documents:create", "documents:read", "reviews:read", "reviews:correct-field", "reviews:manage-tasks", "reviews:decide",
  "processing:read", "processing:reprocess", "audit:read", "audit:export",
  "organization:manage-ai",
];

async function seedDevelopmentOrganization(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("Development bootstrap is disabled in production");
  if (process.env.BOOTSTRAP_DEV_ALLOWED !== "true") throw new Error("Set BOOTSTRAP_DEV_ALLOWED=true to explicitly allow a development bootstrap");
  const name = process.env.BOOTSTRAP_ORG_NAME?.trim();
  const email = process.env.BOOTSTRAP_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_USER_PASSWORD;
  if (!name || !email || !password || password.length < 16) {
    throw new Error("Set BOOTSTRAP_ORG_NAME, BOOTSTRAP_USER_EMAIL, and a BOOTSTRAP_USER_PASSWORD of at least 16 characters");
  }
  if (!process.env.MIGRATIONS_DATABASE_URL) throw new Error("MIGRATIONS_DATABASE_URL is required for the development bootstrap");

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const existing = await manager.query<{ id: string }[]>("SELECT id FROM public.users WHERE normalized_email = $1", [email]);
      if (existing.length) throw new Error("A user with this email already exists; bootstrap never changes existing credentials");
      const organizations = await manager.query<{ id: string }[]>("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", [name]);
      const organizationId = organizations[0]?.id;
      if (!organizationId) throw new Error("Could not create the development organization");
      const users = await manager.query<{ id: string }[]>(
        "INSERT INTO public.users (normalized_email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [email, email, passwordHash],
      );
      const userId = users[0]?.id;
      if (!userId) throw new Error("Could not create the development user");
      await manager.query(
        "INSERT INTO public.organization_memberships (organization_id, user_id, role, permissions) VALUES ($1, $2, 'administrator', $3::text[])",
        [organizationId, userId, permissions],
      );
      console.info(`Development organization and administrator created. Organization ID: ${organizationId}; user: ${email}`);
    });
  } finally {
    await dataSource.destroy();
  }
}

void seedDevelopmentOrganization().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Development bootstrap failed");
  process.exitCode = 1;
});
