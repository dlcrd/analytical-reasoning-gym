import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { Domain, Mode } from "@/db/schema";
import { attempts, modeProgress, modeValues, sessions } from "@/db/schema";
import {
  getExerciseById,
  getExercisesByModeAndLevel,
  getPlacementTestQuestions,
  type ValidatedExercise,
} from "./exercises";
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

interface PlacementQuestionBase {
  id: string;
  mode: Mode;
  domain: Domain;
  level: number;
  title: string;
  prompt: string;
}

interface Option {
  id: string;
  label: string;
}

/**
 * What the Placement Test UI gets per question — a discriminated union so each closed format
 * (multiple_choice/ordering/budget) only carries the fields it needs, and never the correct
 * answer (correctOptionId/correctOrder/correctRecommendationOptionId stay server-side only).
 */
export type PlacementQuestionPreview =
  | (PlacementQuestionBase & {
      questionType: "sql";
      population: string;
      grain: string;
      metricDefinition: string | null;
      transformationPlan: string[] | null;
      expectedColumns: string[] | null;
    })
  | (PlacementQuestionBase & {
      questionType: "multiple_choice";
      explanation: string;
      options: Option[];
    })
  | (PlacementQuestionBase & {
      questionType: "ordering";
      explanation: string;
      steps: Option[];
    })
  | (PlacementQuestionBase & {
      questionType: "budget";
      explanation: string;
      budgetAmount: number;
      investigations: Array<{ id: string; label: string; cost: number; revealText: string }>;
      recommendationOptions: Option[];
    });

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Shuffles steps, retrying (bounded) on the rare chance it lands on the answer key itself. */
function shuffleSteps(steps: Option[], correctOrder: string[]): Option[] {
  let attempt = shuffle(steps);
  for (let i = 0; i < 10 && attempt.every((step, idx) => step.id === correctOrder[idx]); i++) {
    attempt = shuffle(steps);
  }
  return attempt;
}

/**
 * Builds the client-safe preview for one Placement Test question, dispatching by questionType.
 * Never includes referenceSql, commonWrongAnswers, or any of the correct-answer fields.
 */
export async function toPlacementPreview(exercise: ValidatedExercise): Promise<PlacementQuestionPreview> {
  const base: PlacementQuestionBase = {
    id: exercise.id,
    mode: exercise.mode,
    domain: exercise.domain,
    level: exercise.level,
    title: exercise.title,
    prompt: exercise.prompt,
  };

  switch (exercise.questionType) {
    case "multiple_choice":
      return {
        ...base,
        questionType: "multiple_choice",
        explanation: exercise.explanation!,
        options: exercise.options!,
      };
    case "ordering":
      return {
        ...base,
        questionType: "ordering",
        explanation: exercise.explanation!,
        steps: shuffleSteps(exercise.steps!, exercise.correctOrder!),
      };
    case "budget":
      return {
        ...base,
        questionType: "budget",
        explanation: exercise.explanation!,
        budgetAmount: exercise.budgetAmount!,
        investigations: exercise.investigations!,
        recommendationOptions: exercise.recommendationOptions!,
      };
    default: {
      const sqlPreview = await toPreview({
        ...base,
        population: exercise.population!,
        grain: exercise.grain!,
        metricDefinition: exercise.metricDefinition ?? null,
        transformationPlan: exercise.transformationPlan ?? null,
      });
      return { ...sqlPreview, questionType: "sql" };
    }
  }
}

export interface StartPlacementSessionResult {
  sessionId: string;
  exercises: PlacementQuestionPreview[];
}

/** Starts the one-time Placement Test: a new Session plus every eligible L4/L5 question, in a stable order. */
export async function startPlacementSession(db: Db): Promise<StartPlacementSessionResult> {
  const allExercises = await getPlacementTestQuestions();
  const [session] = await db.insert(sessions).values({ type: "placement" }).returning();

  return {
    sessionId: session.id,
    exercises: await Promise.all(allExercises.map(toPlacementPreview)),
  };
}

export interface PlacementAttemptInput {
  exerciseId: string;
  isCorrect: boolean;
  feedbackChecklist: unknown;
}

/**
 * Persists a single Placement Test Attempt as soon as it's answered — this (not a batch at the
 * end) is what makes the Placement Test resumable after closing the browser mid-test.
 */
export async function recordPlacementAttempt(
  db: Db,
  sessionId: string,
  input: PlacementAttemptInput,
): Promise<void> {
  const exercise = await getExerciseById(input.exerciseId);
  if (!exercise) {
    throw new Error(`recordPlacementAttempt: unknown exercise "${input.exerciseId}"`);
  }

  await db.insert(attempts).values({
    sessionId,
    exerciseId: input.exerciseId,
    isCorrect: input.isCorrect,
    feedbackChecklist: input.feedbackChecklist,
  });
}

/**
 * Derives each Mode's starting current_level from the tally of already-persisted Attempts for
 * this Session (see placement.ts), and marks the Session complete. Placement Attempts never
 * count toward a Mode's Level Streak (see CONTEXT.md's "Placement Test" entry).
 */
export async function completePlacementSession(db: Db, sessionId: string): Promise<Record<Mode, number>> {
  const tallies = new Map<Mode, PlacementTally>(
    modeValues.map((mode) => [mode, { level4Correct: 0, level5Correct: 0 }]),
  );

  const storedAttempts = await db.select().from(attempts).where(eq(attempts.sessionId, sessionId));
  for (const attempt of storedAttempts) {
    const exercise = await getExerciseById(attempt.exerciseId);
    if (!exercise) continue;

    if (attempt.isCorrect && (exercise.level === 4 || exercise.level === 5)) {
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

export interface ActivePlacementSession {
  sessionId: string;
  questions: PlacementQuestionPreview[];
  answeredExerciseIds: string[];
}

/**
 * Finds the most recent incomplete Placement Test Session, if any — lets the UI resume exactly
 * where the student left off instead of restarting. Returns null when there's nothing to resume
 * (no Placement Test ever started, or the last one was already completed).
 */
export async function getActivePlacementSession(db: Db): Promise<ActivePlacementSession | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.type, "placement"), isNull(sessions.completedAt)))
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  if (!session) return null;

  const allExercises = await getPlacementTestQuestions();
  const storedAttempts = await db.select().from(attempts).where(eq(attempts.sessionId, session.id));

  return {
    sessionId: session.id,
    questions: await Promise.all(allExercises.map(toPlacementPreview)),
    answeredExerciseIds: storedAttempts.map((attempt) => attempt.exerciseId),
  };
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
