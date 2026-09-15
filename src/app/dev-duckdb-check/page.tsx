"use client";

import { useState } from "react";
import { runSql } from "@/lib/duckdb-runner";
import type { QueryResult } from "@/lib/grading";

// TEMPORARY manual-verification page for the DuckDB-WASM runner. Delete once confirmed working.
export default function DevDuckdbCheckPage() {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const r = await runSql(
        "ecommerce",
        "SELECT channel, count(*) FILTER (WHERE status = 'refunded')::DOUBLE / count(*) AS refund_rate FROM orders GROUP BY channel ORDER BY channel",
      );
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>DuckDB-WASM manual check</h1>
      <button onClick={handleRun} disabled={loading}>
        {loading ? "Running..." : "Run refund-rate-by-channel query"}
      </button>
      {error && <pre style={{ color: "red" }}>{error}</pre>}
      {result && (
        <table border={1} cellPadding={4} style={{ marginTop: 16 }}>
          <thead>
            <tr>
              {result.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
