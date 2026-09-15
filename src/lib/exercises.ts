import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Mode } from "@/db/schema";
import { modeValues } from "@/db/schema";
import type { ExerciseAuthoring } from "../../scripts/exercises/exercise-schema";

export interface ValidatedExercise extends ExerciseAuthoring {
  admittedAt: string;
}

const VALIDATED_DIR = path.join(process.cwd(), "content", "exercises", "validated");

/** The Placement Test's difficulty band — see CONTEXT.md's "Placement Test" entry. */
const PLACEMENT_TEST_LEVELS = [4, 5];

let cache: ValidatedExercise[] | undefined;

async function loadAllExercises(): Promise<ValidatedExercise[]> {
  if (cache) return cache;

  const files = (await readdir(VALIDATED_DIR)).filter((f) => f.endsWith(".json"));
  cache = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(VALIDATED_DIR, file), "utf-8");
      return JSON.parse(raw) as ValidatedExercise;
    }),
  );
  return cache;
}

export async function getAllExercises(): Promise<ValidatedExercise[]> {
  return loadAllExercises();
}

export async function getExercisesByModeAndLevel(
  mode: Mode,
  level: number,
): Promise<ValidatedExercise[]> {
  const all = await loadAllExercises();
  return all.filter((exercise) => exercise.mode === mode && exercise.level === level);
}

export async function getExerciseById(id: string): Promise<ValidatedExercise | undefined> {
  const all = await loadAllExercises();
  return all.find((exercise) => exercise.id === id);
}

/** All admitted exercises at the Placement Test's L4/L5 band, spanning every Mode. */
export async function getPlacementTestExercises(): Promise<ValidatedExercise[]> {
  const all = await loadAllExercises();
  return all.filter(
    (exercise) => PLACEMENT_TEST_LEVELS.includes(exercise.level) && modeValues.includes(exercise.mode),
  );
}
