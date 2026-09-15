/** Formats JS values as DuckDB SQL literals for building bulk INSERT statements. */

export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function sqlNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "NULL";
}

export function sqlDate(value: Date): string {
  return `DATE '${value.toISOString().slice(0, 10)}'`;
}

export function sqlTimestamp(value: Date): string {
  return `TIMESTAMP '${value.toISOString().slice(0, 19).replace("T", " ")}'`;
}

export function sqlNullable(value: string | null): string {
  return value === null ? "NULL" : value;
}
