import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

export interface CreateDbOptions {
  /** Real Postgres connection string. Defaults to process.env.DATABASE_URL. */
  databaseUrl?: string;
  /** Where the local dev fallback's embedded Postgres persists to. ":memory:" for a throwaway instance. */
  pglitePath?: string;
}

/**
 * Creates a fresh Drizzle instance: real Postgres (`drizzle-orm/node-postgres`) when a connection
 * string is available, otherwise a file-persisted embedded Postgres (pglite) for local dev with no
 * external setup — migrations are applied automatically on the fallback since there's no separate
 * migration step to run against it. Production always sets DATABASE_URL, so pglite never loads there.
 */
export async function createDb(options: CreateDbOptions = {}): Promise<Db> {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  if (databaseUrl) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: databaseUrl });
    return drizzle(pool, { schema, casing: "snake_case" });
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const pglitePath = options.pglitePath ?? path.join(process.cwd(), ".data", "dev.pglite");
  const client = pglitePath === ":memory:" ? new PGlite() : new PGlite(pglitePath);
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "src", "db", "migrations") });
  return db;
}

let cachedDb: Promise<Db> | undefined;

/** Memoized app-wide db instance. Use `createDb` directly in tests to avoid shared state. */
export function getDb(): Promise<Db> {
  cachedDb ??= createDb();
  return cachedDb;
}
