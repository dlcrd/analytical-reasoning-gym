import type { QueryResult } from "./grading";

/** The subset of apache-arrow's Table shape this module actually needs — kept narrow so it's fakeable in tests. */
export interface ArrowLikeTable {
  schema: { fields: Array<{ name: string }> };
  toArray(): Array<Record<string, unknown>>;
}

/** Converts a duckdb-wasm query result (an Arrow Table) into the plain shape grading.ts compares against. */
export function arrowTableToQueryResult(table: ArrowLikeTable): QueryResult {
  const columns = table.schema.fields.map((field) => field.name);
  const rows = table.toArray().map((row) => columns.map((column) => row[column]));
  return { columns, rows };
}
