import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { exerciseSkills, exercises, skills } from "@/db/schema";
import { syncExercisesIndex } from "../seed-exercises";
import { createTestDb } from "./test-db";

describe("syncExercisesIndex", () => {
  it("upserts every validated exercise with its domain and skills", async () => {
    const db = await createTestDb();

    const result = await syncExercisesIndex(db);
    expect(result.synced).toBe(73);

    const rows = await db.select().from(exercises);
    expect(rows).toHaveLength(73);

    const [example] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, "ecommerce-sql_build-l3-marketplace-completed-orders"));
    expect(example.mode).toBe("sql_build");
    expect(example.level).toBe(3);
    expect(example.referenceSql).toContain("orders");
    expect(example.questionType).toBe("sql");

    const taggedSkills = await db
      .select()
      .from(exerciseSkills)
      .where(eq(exerciseSkills.exerciseId, example.id));
    expect(taggedSkills.length).toBeGreaterThan(0);

    const skillRows = await db.select().from(skills);
    expect(skillRows.length).toBeGreaterThan(0);
  });

  it("is idempotent — running it twice neither duplicates rows nor errors", async () => {
    const db = await createTestDb();

    await syncExercisesIndex(db);
    const second = await syncExercisesIndex(db);

    expect(second.synced).toBe(73);
    const rows = await db.select().from(exercises);
    expect(rows).toHaveLength(73);
  });
});
