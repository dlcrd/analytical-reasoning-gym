import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { attempts, modeProgress, sessions } from "@/db/schema";
import { createTestDb } from "@/db/__tests__/test-db";
import { syncExercisesIndex } from "@/db/seed-exercises";
import { finalizePlacementSession, startPlacementSession } from "../sessions";

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
