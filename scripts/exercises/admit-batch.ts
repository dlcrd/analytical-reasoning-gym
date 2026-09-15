import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateExercises, type ExerciseValidationResult } from "./validate";

interface LogEntry {
  id: string;
  domain: string;
  mode: string;
  level: number;
  skills: string[];
  admittedAt: string;
}

export interface AdmitBatchesOptions {
  incomingDir: string;
  validatedDir: string;
  logFile: string;
  datasetsRoot: string;
}

export interface AdmitBatchesSummary {
  admitted: string[];
  rejected: ExerciseValidationResult[];
}

async function loadLog(logFile: string): Promise<LogEntry[]> {
  try {
    const raw = await readFile(logFile, "utf-8");
    return JSON.parse(raw) as LogEntry[];
  } catch {
    return [];
  }
}

/**
 * Reads every batch file in `incomingDir`, validates each exercise (schema, reference SQL against
 * its dataset, id uniqueness against everything already admitted), writes admitted exercises to
 * `validatedDir`, and appends them to `logFile` — the history fed into the next generation prompt.
 * Rejected exercises are reported but never written anywhere: "se não validar, não entra".
 */
export async function admitIncomingBatches(
  options: AdmitBatchesOptions,
): Promise<AdmitBatchesSummary> {
  const { incomingDir, validatedDir, logFile, datasetsRoot } = options;
  await mkdir(validatedDir, { recursive: true });

  const log = await loadLog(logFile);
  const alreadyAdmittedIds = new Set(log.map((entry) => entry.id));

  const admitted: string[] = [];
  const rejected: ExerciseValidationResult[] = [];

  const files = (await readdir(incomingDir)).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const raw = await readFile(path.join(incomingDir, file), "utf-8");
    const parsedJson: unknown = JSON.parse(raw);
    const batch = Array.isArray(parsedJson) ? parsedJson : [parsedJson];

    const results = await validateExercises(batch, { datasetsRoot, alreadyAdmittedIds });

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.valid) {
        rejected.push(result);
        continue;
      }

      const exercise = batch[i] as {
        id: string;
        domain: string;
        mode: string;
        level: number;
        skills: string[];
      };
      const admittedAt = new Date().toISOString();

      await writeFile(
        path.join(validatedDir, `${result.id}.json`),
        JSON.stringify({ ...(batch[i] as object), admittedAt }, null, 2),
      );

      log.push({
        id: exercise.id,
        domain: exercise.domain,
        mode: exercise.mode,
        level: exercise.level,
        skills: exercise.skills,
        admittedAt,
      });
      alreadyAdmittedIds.add(result.id);
      admitted.push(result.id);
    }

    const processedDir = path.join(incomingDir, "processed");
    await mkdir(processedDir, { recursive: true });
    await rename(path.join(incomingDir, file), path.join(processedDir, file));
  }

  await writeFile(logFile, JSON.stringify(log, null, 2));

  return { admitted, rejected };
}
