import { describe, expect, it } from "vitest";
import { createTestDb } from "@/db/__tests__/test-db";
import { syncExercisesIndex } from "@/db/seed-exercises";
import { sessions, attempts, modeProgress } from "@/db/schema";
import { getAllExercises } from "@/lib/exercises";
import { computeDashboard, computeSkillStats } from "../dashboard";

describe("computeSkillStats", () => {
  it("tallies correct/total attempts per skill across the exercises answered", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const allExercises = await getAllExercises();
    const [exerciseA, exerciseB] = allExercises;
    const [session] = await db.insert(sessions).values({ type: "practice" }).returning();

    await db.insert(attempts).values([
      { sessionId: session.id, exerciseId: exerciseA.id, isCorrect: true, feedbackChecklist: {} },
      { sessionId: session.id, exerciseId: exerciseA.id, isCorrect: false, feedbackChecklist: {} },
      { sessionId: session.id, exerciseId: exerciseB.id, isCorrect: true, feedbackChecklist: {} },
    ]);

    const stats = await computeSkillStats(db);

    for (const skillKey of exerciseA.skills) {
      const stat = stats.find((s) => s.key === skillKey);
      expect(stat).toBeDefined();
      expect(stat!.total).toBeGreaterThanOrEqual(2);
      expect(stat!.correct).toBeGreaterThanOrEqual(1);
    }

    for (const stat of stats) {
      expect(stat.accuracy).toBeCloseTo(stat.total > 0 ? stat.correct / stat.total : 0);
    }
  });

  it("returns an empty list when there are no attempts yet", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const stats = await computeSkillStats(db);
    expect(stats).toEqual([]);
  });
});

describe("computeDashboard", () => {
  it("combines streak, skill stats, and each mode's current level", async () => {
    const db = await createTestDb();
    await syncExercisesIndex(db);

    const now = new Date();
    const allExercises = await getAllExercises();
    const [session] = await db.insert(sessions).values({ type: "practice" }).returning();
    await db.insert(attempts).values({
      sessionId: session.id,
      exerciseId: allExercises[0].id,
      isCorrect: true,
      feedbackChecklist: {},
      createdAt: now,
    });

    const dashboard = await computeDashboard(db, now);

    expect(dashboard.streakDays).toBe(1);
    expect(dashboard.skills.length).toBeGreaterThan(0);
    expect(dashboard.levelsByMode.metric_lab).toBe(4);

    const [progress] = await db.select().from(modeProgress);
    expect(progress).toBeDefined();
  });
});
