import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { attempts, modeProgress, sessions } from "@/db/schema";
import { createTestDb } from "@/db/__tests__/test-db";
import { syncExercisesIndex } from "@/db/seed-exercises";
import {
  finalizePlacementSession,
  recordPracticeAttempt,
  startPlacementSession,
  startPracticeSession,
} from "../sessions";

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
});

describe("finalizePlacementSession", () => {
  it("persists every attempt, sets each mode's starting level, and marks the session complete", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const { sessionId, exercises } = await startPlacementSession(db);

    // For sql_build: both L5 correct -> should place at L5.
    // For every other mode: nothing correct -> should place at the V1 floor, L3.
    const attemptInputs = exercises.map((exercise) => ({
      exerciseId: exercise.id,
      isCorrect: exercise.mode === "sql_build" && exercise.level === 5,
      feedbackChecklist: { sqlSyntax: true, result: exercise.mode === "sql_build" && exercise.level === 5 },
    }));

    const levelsByMode = await finalizePlacementSession(db, sessionId, attemptInputs);

    expect(levelsByMode.sql_build).toBe(5);
    expect(levelsByMode.metric_lab).toBe(3);
    expect(levelsByMode.granularity_trainer).toBe(3);
    expect(levelsByMode.query_architecture).toBe(3);

    const storedAttempts = await db.select().from(attempts).where(eq(attempts.sessionId, sessionId));
    expect(storedAttempts).toHaveLength(16);

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
      finalizePlacementSession(db, sessionId, [
        { exerciseId: "does-not-exist", isCorrect: true, feedbackChecklist: {} },
      ]),
    ).rejects.toThrow(/unknown exercise/);
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
