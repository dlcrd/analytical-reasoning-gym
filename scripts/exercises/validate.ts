import { readdir } from "node:fs/promises";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { exerciseAuthoringSchema } from "./exercise-schema";

export interface ExerciseValidationResult {
  id: string;
  valid: boolean;
  errors: string[];
}

/** Runs `sql` against a fresh in-memory DuckDB with every Parquet file in `<datasetsRoot>/<domain>/` loaded as a table of the same name. Returns an error message, or null on success. */
async function runReferenceSql(
  domain: string,
  sql: string,
  datasetsRoot: string,
): Promise<string | null> {
  const domainDir = path.join(datasetsRoot, domain);
  const files = await readdir(domainDir);
  const parquetFiles = files.filter((f) => f.endsWith(".parquet"));

  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();
  try {
    for (const file of parquetFiles) {
      const tableName = file.replace(/\.parquet$/, "");
      const filePath = path.join(domainDir, file).replace(/\\/g, "/");
      await connection.run(`CREATE VIEW ${tableName} AS SELECT * FROM read_parquet('${filePath}');`);
    }
    await connection.run(sql);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

/**
 * Validates a batch of candidate exercises: authoring schema, id uniqueness within the batch,
 * and that referenceSql actually executes against the exercise's domain dataset.
 * Nothing here checks ids against previously-admitted batches — see the generation log for that.
 */
export async function validateExercises(
  candidates: unknown[],
  options: { datasetsRoot: string; alreadyAdmittedIds?: Set<string> },
): Promise<ExerciseValidationResult[]> {
  const results: ExerciseValidationResult[] = [];
  const seenIds = new Set<string>();
  const alreadyAdmittedIds = options.alreadyAdmittedIds ?? new Set<string>();

  for (const candidate of candidates) {
    const candidateId =
      typeof candidate === "object" && candidate !== null && "id" in candidate && typeof candidate.id === "string"
        ? candidate.id
        : "(missing id)";

    const parsed = exerciseAuthoringSchema.safeParse(candidate);
    if (!parsed.success) {
      results.push({
        id: candidateId,
        valid: false,
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
      continue;
    }

    const exercise = parsed.data;
    const errors: string[] = [];

    if (seenIds.has(exercise.id)) {
      errors.push(`duplicate id within this batch: ${exercise.id}`);
    }
    if (alreadyAdmittedIds.has(exercise.id)) {
      errors.push(`id already admitted in a previous batch: ${exercise.id}`);
    }
    seenIds.add(exercise.id);

    const sqlError = await runReferenceSql(exercise.domain, exercise.referenceSql, options.datasetsRoot);
    if (sqlError) {
      errors.push(`reference SQL failed: ${sqlError}`);
    }

    results.push({ id: exercise.id, valid: errors.length === 0, errors });
  }

  return results;
}
