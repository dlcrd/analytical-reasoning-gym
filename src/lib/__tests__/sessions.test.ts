import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { attempts, modeProgress, sessions } from "@/db/schema";
import { createTestDb } from "@/db/__tests__/test-db";
import { syncExercisesIndex } from "@/db/seed-exercises";
import { exerciseAuthoringSchema } from "../../../scripts/exercises/exercise-schema";
import type { ValidatedExercise } from "../exercises";
import {
  completePlacementSession,
  getActivePlacementSession,
  recordPlacementAttempt,
  recordPracticeAttempt,
  startPlacementSession,
  startPracticeSession,
  toPlacementPreview,
} from "../sessions";

/** Builds a fully-shaped ValidatedExercise fixture (schema defaults filled in) for toPlacementPreview tests. */
function fixture(overrides: Record<string, unknown>): ValidatedExercise {
  return {
    ...exerciseAuthoringSchema.parse({
      id: "ecommerce-metric_lab-l4-mc-numerator",
      domain: "ecommerce",
      mode: "metric_lab",
      level: 4,
      skills: ["metric_definition"],
      title: "Pick the right numerator",
      prompt: "...",
      population: "...",
      grain: "...",
      ...overrides,
    }),
    admittedAt: new Date().toISOString(),
  };
}

describe("toPlacementPreview", () => {
  it("never leaks correctOptionId for a multiple_choice question", async () => {
    const preview = await toPlacementPreview(
      fixture({
        questionType: "multiple_choice",
        explanation: "Because...",
        options: [
          { id: "a", label: "Completed orders only" },
          { id: "b", label: "All orders" },
        ],
        correctOptionId: "b",
      }),
    );

    expect(preview.questionType).toBe("multiple_choice");
    expect(preview).not.toHaveProperty("correctOptionId");
    if (preview.questionType === "multiple_choice") {
      expect(preview.options).toEqual([
        { id: "a", label: "Completed orders only" },
        { id: "b", label: "All orders" },
      ]);
    }
  });

  it("shuffles ordering steps and never leaks correctOrder", async () => {
    const correctOrder = ["filter", "aggregate", "window"];
    const steps = [
      { id: "filter", label: "Filter" },
      { id: "aggregate", label: "Aggregate" },
      { id: "window", label: "Window" },
    ];

    const preview = await toPlacementPreview(
      fixture({
        questionType: "ordering",
        explanation: "Because...",
        steps,
        correctOrder,
      }),
    );

    expect(preview.questionType).toBe("ordering");
    expect(preview).not.toHaveProperty("correctOrder");
    if (preview.questionType === "ordering") {
      expect(preview.steps.map((s) => s.id).sort()).toEqual([...correctOrder].sort());
    }
  });

  it("never leaks correctRecommendationOptionId for a budget question", async () => {
    const preview = await toPlacementPreview(
      fixture({
        questionType: "budget",
        explanation: "Because...",
        budgetAmount: 10,
        investigations: [{ id: "reason_codes", label: "Check reason codes", cost: 3, revealText: "..." }],
        recommendationOptions: [
          { id: "defect", label: "Escalate to product quality" },
          { id: "pricing", label: "Escalate to pricing" },
        ],
        correctRecommendationOptionId: "defect",
      }),
    );

    expect(preview.questionType).toBe("budget");
    expect(preview).not.toHaveProperty("correctRecommendationOptionId");
    if (preview.questionType === "budget") {
      expect(preview.budgetAmount).toBe(10);
      expect(preview.investigations).toHaveLength(1);
    }
  });

  it("still includes expectedColumns for a sql question", async () => {
    const preview = await toPlacementPreview(
      fixture({
        id: "ecommerce-sql_build-l3-marketplace-completed-orders",
        mode: "sql_build",
        referenceSql: "select count(*) as n from orders",
      }),
    );

    expect(preview.questionType).toBe("sql");
    if (preview.questionType === "sql") {
      expect(preview.expectedColumns).not.toBeNull();
    }
  });
});

describe("startPlacementSession", () => {
  it("creates a placement session and returns all 16 L4/L5 exercises without the reference SQL", async () => {
    const db = await createTestDb();

    const { sessionId, exercises } = await startPlacementSession(db);

    expect(exercises).toHaveLength(16);
    expect(exercises.every((exercise) => exercise.level === 4 || exercise.level === 5)).toBe(true);
    expect(exercises.every((exercise) => !("referenceSql" in exercise))).toBe(true);
    expect(exercises.every((exercise) => !("commonWrongAnswers" in exercise))).toBe(true);

    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    expect(session.type).toBe("placement");
    expect(session.completedAt).toBeNull();
  });

  it("includes the expected output columns (never the reference SQL itself) for each exercise", async () => {
    const db = await createTestDb();

    const { exercises } = await startPlacementSession(db);

    expect(exercises.length).toBeGreaterThan(0);
    const sqlExercises = exercises.filter((exercise) => exercise.questionType === "sql");
    expect(sqlExercises.length).toBeGreaterThan(0);
    for (const exercise of sqlExercises) {
      expect(exercise.expectedColumns).not.toBeNull();
      expect(exercise.expectedColumns!.length).toBeGreaterThan(0);
    }
  });
});

describe("recordPlacementAttempt + completePlacementSession", () => {
  it("persists every attempt as it's answered, sets each mode's starting level, and marks the session complete", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const { sessionId, exercises } = await startPlacementSession(db);

    // For sql_build: both L5 correct -> should place at L5.
    // For every other mode: nothing correct -> should place at the V1 floor, L3.
    for (const exercise of exercises) {
      const isCorrect = exercise.mode === "sql_build" && exercise.level === 5;
      await recordPlacementAttempt(db, sessionId, {
        exerciseId: exercise.id,
        isCorrect,
        feedbackChecklist: { sqlSyntax: true, result: isCorrect },
      });
    }

    // Attempts are already in the DB before completion is ever called — this is what makes resume possible.
    const storedBeforeCompletion = await db.select().from(attempts).where(eq(attempts.sessionId, sessionId));
    expect(storedBeforeCompletion).toHaveLength(exercises.length);

    const levelsByMode = await completePlacementSession(db, sessionId);

    expect(levelsByMode.sql_build).toBe(5);
    expect(levelsByMode.metric_lab).toBe(3);
    expect(levelsByMode.granularity_trainer).toBe(3);
    expect(levelsByMode.query_architecture).toBe(3);

    const [sqlBuildProgress] = await db
      .select()
      .from(modeProgress)
      .where(eq(modeProgress.mode, "sql_build"));
    expect(sqlBuildProgress.currentLevel).toBe(5);
    expect(sqlBuildProgress.levelStreak).toBe(0);

    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    expect(session.completedAt).not.toBeNull();
  });

  it("throws on an unknown exercise id instead of silently dropping the attempt", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);
    const { sessionId } = await startPlacementSession(db);

    await expect(
      recordPlacementAttempt(db, sessionId, { exerciseId: "does-not-exist", isCorrect: true, feedbackChecklist: {} }),
    ).rejects.toThrow(/unknown exercise/);
  });
});

describe("getActivePlacementSession", () => {
  it("returns null when there is no incomplete placement session", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    expect(await getActivePlacementSession(db)).toBeNull();
  });

  it("returns the in-progress session's questions and which ones are already answered", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const { sessionId, exercises } = await startPlacementSession(db);
    const [first, second] = exercises;

    await recordPlacementAttempt(db, sessionId, {
      exerciseId: first.id,
      isCorrect: true,
      feedbackChecklist: { sqlSyntax: true, result: true },
    });

    const active = await getActivePlacementSession(db);

    expect(active).not.toBeNull();
    expect(active!.sessionId).toBe(sessionId);
    expect(active!.questions.map((q) => q.id)).toEqual(exercises.map((e) => e.id));
    expect(active!.answeredExerciseIds).toEqual([first.id]);
    expect(active!.answeredExerciseIds).not.toContain(second.id);
  });

  it("returns null once the session has been completed", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const { sessionId, exercises } = await startPlacementSession(db);
    for (const exercise of exercises) {
      await recordPlacementAttempt(db, sessionId, {
        exerciseId: exercise.id,
        isCorrect: true,
        feedbackChecklist: {},
      });
    }
    await completePlacementSession(db, sessionId);

    expect(await getActivePlacementSession(db)).toBeNull();
  });
});

describe("startPracticeSession", () => {
  it("creates a practice session and returns an exercise at the mode's current level", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const result = await startPracticeSession(db, "metric_lab");

    expect(result.currentLevel).toBe(4);
    expect(result.levelStreak).toBe(0);
    expect(result.exercise?.mode).toBe("metric_lab");
    expect(result.exercise?.level).toBe(4);
    expect(result.exercise && "referenceSql" in result.exercise).toBe(false);

    const [session] = await db.select().from(sessions).where(eq(sessions.id, result.sessionId));
    expect(session.type).toBe("practice");
  });
});

describe("recordPracticeAttempt", () => {
  it("persists the attempt, advances the level after 2 correct answers in a row, and returns a next exercise", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const { sessionId, exercise: first } = await startPracticeSession(db, "metric_lab");
    if (!first) throw new Error("expected an exercise for metric_lab at L4");

    const firstResult = await recordPracticeAttempt(db, {
      sessionId,
      exerciseId: first.id,
      isCorrect: true,
      feedbackChecklist: { sqlSyntax: true, result: true },
    });
    expect(firstResult.currentLevel).toBe(4);
    expect(firstResult.levelStreak).toBe(1);
    expect(firstResult.leveledUp).toBe(false);
    expect(firstResult.nextExercise?.mode).toBe("metric_lab");
    expect(firstResult.nextExercise?.level).toBe(4);

    const secondResult = await recordPracticeAttempt(db, {
      sessionId,
      exerciseId: firstResult.nextExercise!.id,
      isCorrect: true,
      feedbackChecklist: { sqlSyntax: true, result: true },
    });
    expect(secondResult.currentLevel).toBe(5);
    expect(secondResult.levelStreak).toBe(0);
    expect(secondResult.leveledUp).toBe(true);
    expect(secondResult.nextExercise?.level).toBe(5);

    const storedAttempts = await db.select().from(attempts).where(eq(attempts.sessionId, sessionId));
    expect(storedAttempts).toHaveLength(2);

    const [progress] = await db.select().from(modeProgress).where(eq(modeProgress.mode, "metric_lab"));
    expect(progress.currentLevel).toBe(5);
    expect(progress.levelStreak).toBe(0);
  });

  it("resets the streak on a miss without lowering the level", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);
    const { sessionId, exercise: first } = await startPracticeSession(db, "metric_lab");
    if (!first) throw new Error("expected an exercise for metric_lab at L4");

    const result = await recordPracticeAttempt(db, {
      sessionId,
      exerciseId: first.id,
      isCorrect: false,
      feedbackChecklist: { sqlSyntax: true, result: false },
    });

    expect(result.currentLevel).toBe(4);
    expect(result.levelStreak).toBe(0);
    expect(result.leveledUp).toBe(false);
  });

  it("throws on an unknown exercise id", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);
    const { sessionId } = await startPracticeSession(db, "metric_lab");

    await expect(
      recordPracticeAttempt(db, {
        sessionId,
        exerciseId: "does-not-exist",
        isCorrect: true,
        feedbackChecklist: {},
      }),
    ).rejects.toThrow(/unknown exercise/);
  });
});
