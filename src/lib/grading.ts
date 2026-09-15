const NUMERIC_TOLERANCE = 1e-6;

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface ComparisonResult {
  matches: boolean;
  /** Generic diagnostic only — never leaks the expected values (no answer reveal). */
  reason?: string;
}

type NormalizedValue = string | number | boolean | null;

function normalize(value: unknown): NormalizedValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function cellsEqual(a: NormalizedValue, b: NormalizedValue): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= NUMERIC_TOLERANCE;
  }
  return a === b;
}

function rowsEqual(a: NormalizedValue[], b: NormalizedValue[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => cellsEqual(value, b[i]));
}

/** Sort key that buckets near-equal floats together despite tiny rounding differences. */
function sortKey(row: NormalizedValue[]): string {
  return JSON.stringify(
    row.map((value) => (typeof value === "number" ? Math.round(value / NUMERIC_TOLERANCE) : value)),
  );
}

/**
 * Compares two query result sets as unordered multisets of rows (SQL result order is undefined
 * without ORDER BY). Grades on values only, not column names/aliases — a student's chosen alias
 * shouldn't fail them. Never includes the expected values in `reason` (no answer reveal).
 */
export function compareResultSets(actual: QueryResult, expected: QueryResult): ComparisonResult {
  if (actual.rows.length !== expected.rows.length) {
    return {
      matches: false,
      reason: `expected ${expected.rows.length} row(s), got ${actual.rows.length}`,
    };
  }

  const normalizedActual = actual.rows.map((row) => row.map(normalize)).sort((a, b) =>
    sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0,
  );
  const normalizedExpected = expected.rows.map((row) => row.map(normalize)).sort((a, b) =>
    sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0,
  );

  for (let i = 0; i < normalizedActual.length; i++) {
    if (!rowsEqual(normalizedActual[i], normalizedExpected[i])) {
      return { matches: false, reason: "row values differ from the expected result" };
    }
  }

  return { matches: true };
}
