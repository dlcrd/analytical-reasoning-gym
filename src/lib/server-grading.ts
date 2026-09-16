import { readdir } from "node:fs/promises";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { getExerciseById } from "./exercises";
import { compareResultSets, type ComparisonResult, type QueryResult } from "./grading";

const DATASETS_ROOT = path.join(process.cwd(), "public", "datasets");

/**
 * Runs `sql` server-side against a fresh in-memory DuckDB with every Parquet file in
 * `public/datasets/<domain>/` loaded as a table of the same name. See
 * docs/adr/0005-grading-runs-server-side-against-reference-sql.md — this is only ever
 * called with an exercise's authored, trusted referenceSql, never with student input.
 */
async function runSqlServerSide(domain: string, sql: string): Promise<QueryResult> {
  const domainDir = path.join(DATASETS_ROOT, domain);
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

    const reader = await connection.runAndReadAll(sql);
    const rows = (reader.getRowsJS() as unknown[][]).map((row) =>
      row.map((cell) => (typeof cell === "bigint" ? Number(cell) : cell)),
    );
    return { columns: reader.columnNames(), rows };
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

/** Executes an exercise's own referenceSql server-side and returns its result. Never exposed to the client as-is. */
export async function computeReferenceResult(exerciseId: string): Promise<QueryResult> {
  const exercise = await getExerciseById(exerciseId);
  if (!exercise) {
    throw new Error(`computeReferenceResult: unknown exercise "${exerciseId}"`);
  }
  return runSqlServerSide(exercise.domain, exercise.referenceSql);
}

/**
 * Grades a student's already-executed query result against `exerciseId`'s referenceSql,
 * re-run here server-side. Returns only matches/reason — never the expected rows.
 */
export async function gradeAttempt(exerciseId: string, studentResult: QueryResult): Promise<ComparisonResult> {
  const expected = await computeReferenceResult(exerciseId);
  return compareResultSets(studentResult, expected);
}
