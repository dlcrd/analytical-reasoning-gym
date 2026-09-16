import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { Domain, Mode } from "@/db/schema";
import { attempts, modeProgress, modeValues, sessions } from "@/db/schema";
import { getExerciseById, getExercisesByModeAndLevel, getPlacementTestExercises } from "./exercises";
import { derivePlacementLevel, type PlacementTally } from "./placement";
import { nextPracticeProgress } from "./practice";
import { computeReferenceResult } from "./server-grading";

/**
 * What Placement Test and Practice Mode UIs get per exercise — everything needed to render the
 * concept-first steps, but never the reference SQL or common-wrong-answer prose
 * (see docs/adr/0004-concept-steps-are-self-assessed-not-auto-graded.md).
 */
export interface ExercisePreview {
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
  /** Column names the referenceSql produces — a format hint, never the SQL itself or its rows. Null if it couldn't be computed. */
  expectedColumns: string[] | null;
}

async function toPreview(exercise: {
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
}): Promise<ExercisePreview> {
  let expectedColumns: string[] | null = null;
  try {
    expectedColumns = (await computeReferenceResult(exercise.id)).columns;
  } catch {
    // Format hint is best-effort — never block a session on it.
  }

  return {
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
    expectedColumns,
  };
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export interface StartPlacementSessionResult {
  sessionId: string;
  exercises: ExercisePreview[];
}

/** Starts the one-time Placement Test: a new Session plus all 16 L4/L5 exercises spanning every Mode. */
export async function startPlacementSession(db: Db): Promise<StartPlacementSessionResult> {
  const allExercises = await getPlacementTestExercises();
  const [session] = await db.insert(sessions).values({ type: "placement" }).returning();

  return {
    sessionId: session.id,
    exercises: await Promise.all(allExercises.map(toPreview)),
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

export interface StartPracticeSessionResult {
  sessionId: string;
  currentLevel: number;
  levelStreak: number;
  /** null only if a mode/level combination has no admitted exercises yet. */
  exercise: ExercisePreview | null;
}

/** Starts a Practice Mode session: a new Session plus one exercise at the mode's current level. */
export async function startPracticeSession(db: Db, mode: Mode): Promise<StartPracticeSessionResult> {
  const [progress] = await db.select().from(modeProgress).where(eq(modeProgress.mode, mode));
  const [session] = await db.insert(sessions).values({ type: "practice" }).returning();
  const candidates = await getExercisesByModeAndLevel(mode, progress.currentLevel);
  const exercise = pickRandom(candidates);

  return {
    sessionId: session.id,
    currentLevel: progress.currentLevel,
    levelStreak: progress.levelStreak,
    exercise: exercise ? await toPreview(exercise) : null,
  };
}

export interface RecordPracticeAttemptInput {
  sessionId: string;
  exerciseId: string;
  isCorrect: boolean;
  feedbackChecklist: unknown;
}

export interface RecordPracticeAttemptResult {
  currentLevel: number;
  levelStreak: number;
  leveledUp: boolean;
  /** null only if the (possibly new) mode/level combination has no admitted exercises yet. */
  nextExercise: ExercisePreview | null;
}

/**
 * Persists one Practice Mode Attempt, applies the level-progression rule (see practice.ts),
 * and returns a next exercise at the (possibly advanced) current level, distinct from the one
 * just answered when the level has other exercises to pick from.
 */
export async function recordPracticeAttempt(
  db: Db,
  input: RecordPracticeAttemptInput,
): Promise<RecordPracticeAttemptResult> {
  const exercise = await getExerciseById(input.exerciseId);
  if (!exercise) {
    throw new Error(`recordPracticeAttempt: unknown exercise "${input.exerciseId}"`);
  }

  await db.insert(attempts).values({
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    isCorrect: input.isCorrect,
    feedbackChecklist: input.feedbackChecklist,
  });

  const [progress] = await db.select().from(modeProgress).where(eq(modeProgress.mode, exercise.mode));
  const updated = nextPracticeProgress(progress, input.isCorrect);
  await db
    .update(modeProgress)
    .set({ currentLevel: updated.currentLevel, levelStreak: updated.levelStreak, updatedAt: new Date() })
    .where(eq(modeProgress.mode, exercise.mode));

  const candidates = await getExercisesByModeAndLevel(exercise.mode, updated.currentLevel);
  const remaining = candidates.filter((candidate) => candidate.id !== input.exerciseId);
  const nextExercise = pickRandom(remaining.length > 0 ? remaining : candidates);

  return {
    currentLevel: updated.currentLevel,
    levelStreak: updated.levelStreak,
    leveledUp: updated.currentLevel > progress.currentLevel,
    nextExercise: nextExercise ? await toPreview(nextExercise) : null,
  };
}
