import { getAllExercises } from "@/lib/exercises";
import type { Db } from "./client";
import { domains, exerciseSkills, exercises, skills } from "./schema";

function humanizeSkillKey(key: string): string {
  return key
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export interface SyncResult {
  synced: number;
}

/**
 * Upserts every exercise in content/exercises/validated/ into the Postgres index
 * (exercises, exercise_skills, and any not-yet-seen skills). Idempotent — safe to
 * rerun after generating a new batch. Domains/datasets are pre-seeded by migration,
 * not created here.
 */
export async function syncExercisesIndex(db: Db): Promise<SyncResult> {
  const allExercises = await getAllExercises();

  const domainRows = await db.select().from(domains);
  const domainIdBySlug = new Map(domainRows.map((d) => [d.slug, d.id]));

  const skillKeys = new Set(allExercises.flatMap((exercise) => exercise.skills));
  for (const key of skillKeys) {
    await db
      .insert(skills)
      .values({ key, label: humanizeSkillKey(key) })
      .onConflictDoNothing();
  }

  for (const exercise of allExercises) {
    const domainId = domainIdBySlug.get(exercise.domain);
    if (!domainId) {
      throw new Error(`syncExercisesIndex: unknown domain "${exercise.domain}" on exercise ${exercise.id}`);
    }

    const row = {
      mode: exercise.mode,
      domainId,
      level: exercise.level,
      questionType: exercise.questionType,
      title: exercise.title,
      prompt: exercise.prompt,
      referenceSql: exercise.referenceSql,
      validatedAt: new Date(exercise.admittedAt),
    };

    await db
      .insert(exercises)
      .values({ id: exercise.id, ...row })
      .onConflictDoUpdate({ target: exercises.id, set: row });

    for (const skillKey of exercise.skills) {
      await db
        .insert(exerciseSkills)
        .values({ exerciseId: exercise.id, skillKey })
        .onConflictDoNothing();
    }
  }

  return { synced: allExercises.length };
}
