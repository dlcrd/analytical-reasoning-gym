import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "../client";
import { modeProgress } from "../schema";

describe("createDb", () => {
  it("falls back to an in-memory Postgres and applies migrations when no databaseUrl is given", async () => {
    const db = await createDb({ pglitePath: ":memory:" });

    const rows = await db.select().from(modeProgress);
    expect(rows).toHaveLength(4);
  });

  it("gives each pglite fallback instance independent, migrated state", async () => {
    const dbA = await createDb({ pglitePath: ":memory:" });
    await dbA
      .update(modeProgress)
      .set({ currentLevel: 7 })
      .where(eq(modeProgress.mode, "sql_build"));

    const dbB = await createDb({ pglitePath: ":memory:" });
    const [row] = await dbB
      .select()
      .from(modeProgress)
      .where(eq(modeProgress.mode, "sql_build"));

    expect(row.currentLevel).toBe(4);
  });

  it("builds a real-Postgres-backed db without eagerly connecting when databaseUrl is given", async () => {
    await expect(
      createDb({ databaseUrl: "postgres://user:pass@localhost:59999/does_not_exist" }),
    ).resolves.toBeDefined();
  });
});
