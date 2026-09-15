import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { Domain, Mode } from "@/db/schema";
import { attempts, modeProgress, modeValues, sessions } from "@/db/schema";
import { getExerciseById, getPlacementTestExercises } from "./exercises";
import { derivePlacementLevel, type PlacementTally } from "./placement";

/**
 * What the Placement Test UI gets per exercise — everything needed to render the
 * concept-first steps, but never the reference SQL or common-wrong-answer prose
 * (see docs/adr/0004-concept-steps-are-self-assessed-not-auto-graded.md).
 */
export interface PlacementExercisePreview {
  id: string;
  mode: Mode;
  domain: Domain;
  level: number;
  title: string;
  prompt: string;
  population: string;
  grain: string;
  metricDefinition: string | null;
  transformationPlan: string[] | null;
}

export interface StartPlacementSessionResult {
  sessionId: string;
  exercises: PlacementExercisePreview[];
}

/** Starts the one-time Placement Test: a new Session plus all 16 L4/L5 exercises spanning every Mode. */
export async function startPlacementSession(db: Db): Promise<StartPlacementSessionResult> {
  const allExercises = await getPlacementTestExercises();
  const [session] = await db.insert(sessions).values({ type: "placement" }).returning();

  return {
    sessionId: session.id,
    exercises: allExercises.map((exercise) => ({
      id: exercise.id,
      mode: exercise.mode,
      domain: exercise.domain,
      level: exercise.level,
      title: exercise.title,
      prompt: exercise.prompt,
      population: exercise.population,
      grain: exercise.grain,
      metricDefinition: exercise.metricDefinition,
      transformationPlan: exercise.transformationPlan,
    })),
  };
}

export interface PlacementAttemptInput {
  exerciseId: string;
  isCorrect: boolean;
  feedbackChecklist: unknown;
}

/**
 * Persists every Placement Test Attempt, derives each Mode's starting current_level from the
 * L4/L5 tally (see placement.ts), and marks the Session complete. Placement Attempts never
 * count toward a Mode's Level Streak (see CONTEXT.md's "Placement Test" entry).
 */
export async function finalizePlacementSession(
  db: Db,
  sessionId: string,
  attemptInputs: PlacementAttemptInput[],
): Promise<Record<Mode, number>> {
  const tallies = new Map<Mode, PlacementTally>(
    modeValues.map((mode) => [mode, { level4Correct: 0, level5Correct: 0 }]),
  );

  for (const input of attemptInputs) {
    const exercise = await getExerciseById(input.exerciseId);
    if (!exercise) {
      throw new Error(`finalizePlacementSession: unknown exercise "${input.exerciseId}"`);
    }

    await db.insert(attempts).values({
      sessionId,
      exerciseId: input.exerciseId,
      isCorrect: input.isCorrect,
      feedbackChecklist: input.feedbackChecklist,
    });

    if (input.isCorrect && (exercise.level === 4 || exercise.level === 5)) {
      const tally = tallies.get(exercise.mode);
      if (tally) {
        if (exercise.level === 4) tally.level4Correct += 1;
        else tally.level5Correct += 1;
      }
    }
  }

  const levelsByMode = {} as Record<Mode, number>;
  for (const [mode, tally] of tallies) {
    const currentLevel = derivePlacementLevel(tally);
    levelsByMode[mode] = currentLevel;
    await db
      .update(modeProgress)
      .set({ currentLevel, levelStreak: 0, updatedAt: new Date() })
      .where(eq(modeProgress.mode, mode));
  }

  await db.update(sessions).set({ completedAt: new Date() }).where(eq(sessions.id, sessionId));

  return levelsByMode;
}
