import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  attempts,
  datasets,
  domains,
  exerciseSkills,
  exercises,
  modeProgress,
  modeValues,
  sessions,
  skills,
} from "@/db/schema";
import { createTestDb } from "./test-db";
import { randomUUID } from "node:crypto";

// domains/datasets are seeded by migration (0002_seed_domains_and_datasets) — fetch, don't insert.
async function seedDomain(db: Awaited<ReturnType<typeof createTestDb>>) {
  const [domain] = await db.select().from(domains).where(eq(domains.slug, "ecommerce"));
  return domain;
}

describe("domains and datasets", () => {
  it("is seeded with exactly the 3 fixed domains, each with its one dataset", async () => {
    const db = await createTestDb();

    const domainRows = await db.select().from(domains);
    expect(new Set(domainRows.map((d) => d.slug))).toEqual(
      new Set(["ecommerce", "saas", "fintech"]),
    );

    const datasetRows = await db.select().from(datasets);
    expect(datasetRows).toHaveLength(3);
    for (const domain of domainRows) {
      expect(datasetRows.some((d) => d.domainId === domain.id)).toBe(true);
    }
  });

  it("rejects a second dataset for a domain that already has one", async () => {
    const db = await createTestDb();
    const ecommerce = await seedDomain(db);

    await expect(
      db.insert(datasets).values({
        domainId: ecommerce.id,
        slug: "ecommerce-alt",
        description: "A second dataset for the same domain",
      }),
    ).rejects.toThrow();
  });
});

describe("exercises", () => {
  it("rejects a level outside 1-10 and accepts the boundary values", async () => {
    const db = await createTestDb();
    const domain = await seedDomain(db);

    const baseExercise = {
      mode: "sql_build" as const,
      domainId: domain.id,
      title: "Monthly revenue by region",
      prompt: "Given the orders table, ...",
      referenceSql: "select 1",
    };

    await expect(
      db.insert(exercises).values({ ...baseExercise, id: "ecommerce-sql_build-l0-x", level: 0 }),
    ).rejects.toThrow();
    await expect(
      db.insert(exercises).values({ ...baseExercise, id: "ecommerce-sql_build-l11-x", level: 11 }),
    ).rejects.toThrow();

    await db.insert(exercises).values({ ...baseExercise, id: "ecommerce-sql_build-l3-x", level: 3 });
    await db.insert(exercises).values({ ...baseExercise, id: "ecommerce-sql_build-l10-x", level: 10 });

    const rows = await db.select().from(exercises);
    expect(rows).toHaveLength(2);
  });

  it("defaults questionType to sql and accepts a non-sql exercise with no referenceSql", async () => {
    const db = await createTestDb();
    const domain = await seedDomain(db);

    const [sqlExercise] = await db
      .insert(exercises)
      .values({
        id: "ecommerce-sql_build-l3-default-type",
        mode: "sql_build",
        domainId: domain.id,
        level: 3,
        title: "Default question type",
        prompt: "...",
        referenceSql: "select 1",
      })
      .returning();
    expect(sqlExercise.questionType).toBe("sql");

    const [closedExercise] = await db
      .insert(exercises)
      .values({
        id: "ecommerce-metric_lab-l4-mc-numerator",
        mode: "metric_lab",
        domainId: domain.id,
        level: 4,
        questionType: "multiple_choice",
        title: "Pick the right numerator",
        prompt: "...",
        referenceSql: null,
      })
      .returning();
    expect(closedExercise.questionType).toBe("multiple_choice");
    expect(closedExercise.referenceSql).toBeNull();
  });
});

describe("exercise_skills", () => {
  it("rejects tagging the same exercise with the same skill twice", async () => {
    const db = await createTestDb();
    const domain = await seedDomain(db);

    const [exercise] = await db
      .insert(exercises)
      .values({
        id: "ecommerce-sql_build-l5-monthly-revenue",
        mode: "sql_build",
        domainId: domain.id,
        level: 5,
        title: "Monthly revenue by region",
        prompt: "Given the orders table, ...",
        referenceSql: "select 1",
      })
      .returning();

    const [skill] = await db
      .insert(skills)
      .values({ key: "metric_definition", label: "Metric Definition" })
      .returning();

    await db
      .insert(exerciseSkills)
      .values({ exerciseId: exercise.id, skillKey: skill.key });

    await expect(
      db
        .insert(exerciseSkills)
        .values({ exerciseId: exercise.id, skillKey: skill.key }),
    ).rejects.toThrow();
  });
});

describe("attempts", () => {
  it("rejects an attempt referencing a non-existent session or exercise", async () => {
    const db = await createTestDb();
    const domain = await seedDomain(db);

    const [exercise] = await db
      .insert(exercises)
      .values({
        id: "ecommerce-sql_build-l5-monthly-revenue",
        mode: "sql_build",
        domainId: domain.id,
        level: 5,
        title: "Monthly revenue by region",
        prompt: "Given the orders table, ...",
        referenceSql: "select 1",
      })
      .returning();

    const [session] = await db
      .insert(sessions)
      .values({ type: "practice" })
      .returning();

    await expect(
      db.insert(attempts).values({
        sessionId: randomUUID(),
        exerciseId: exercise.id,
        isCorrect: true,
        feedbackChecklist: {},
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(attempts).values({
        sessionId: session.id,
        exerciseId: "does-not-exist",
        isCorrect: true,
        feedbackChecklist: {},
      }),
    ).rejects.toThrow();

    await db.insert(attempts).values({
      sessionId: session.id,
      exerciseId: exercise.id,
      isCorrect: true,
      feedbackChecklist: { sqlSyntax: "pass", population: "pass" },
    });

    const rows = await db.select().from(attempts);
    expect(rows).toHaveLength(1);
  });
});

describe("mode_progress", () => {
  it("is seeded with exactly one row per mode", async () => {
    const db = await createTestDb();

    const rows = await db.select().from(modeProgress);

    expect(rows).toHaveLength(modeValues.length);
    expect(new Set(rows.map((row) => row.mode))).toEqual(new Set(modeValues));
    for (const row of rows) {
      expect(row.currentLevel).toBeGreaterThanOrEqual(1);
      expect(row.currentLevel).toBeLessThanOrEqual(10);
      expect(row.levelStreak).toBe(0);
    }
  });
});

describe("full attempt lifecycle", () => {
  it("records a correct attempt against a multi-skill exercise and reads its skills back via the join table", async () => {
    const db = await createTestDb();
    const domain = await seedDomain(db);

    const [exercise] = await db
      .insert(exercises)
      .values({
        id: "ecommerce-query_architecture-l6-repeat-purchase-rate",
        mode: "query_architecture",
        domainId: domain.id,
        level: 6,
        title: "Repeat purchase rate by cohort",
        prompt: "Given orders and customers, ...",
        referenceSql: "select 1",
      })
      .returning();

    const [grainSkill, metricSkill] = await db
      .insert(skills)
      .values([
        { key: "grain", label: "Grain" },
        { key: "metric_definition", label: "Metric Definition" },
      ])
      .returning();

    await db.insert(exerciseSkills).values([
      { exerciseId: exercise.id, skillKey: grainSkill.key },
      { exerciseId: exercise.id, skillKey: metricSkill.key },
    ]);

    const [session] = await db
      .insert(sessions)
      .values({ type: "practice" })
      .returning();

    const checklist = {
      sqlSyntax: "pass",
      population: "pass",
      grain: "pass",
      metricDefinition: "pass",
      transformationPlan: "pass",
      validation: "pass",
    };

    await db.insert(attempts).values({
      sessionId: session.id,
      exerciseId: exercise.id,
      isCorrect: true,
      feedbackChecklist: checklist,
    });

    const taggedSkills = await db
      .select({ key: skills.key })
      .from(exerciseSkills)
      .innerJoin(skills, eq(exerciseSkills.skillKey, skills.key))
      .where(eq(exerciseSkills.exerciseId, exercise.id));

    expect(new Set(taggedSkills.map((row) => row.key))).toEqual(
      new Set(["grain", "metric_definition"]),
    );

    const [storedAttempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.exerciseId, exercise.id));

    expect(storedAttempt.isCorrect).toBe(true);
    expect(storedAttempt.feedbackChecklist).toEqual(checklist);
  });
});
