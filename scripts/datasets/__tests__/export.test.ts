import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ECOMMERCE_ROW_COUNTS } from "../ecommerce";
import { exportDomainDataset } from "../export";

describe("exportDomainDataset", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "arg-dataset-"));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("writes a queryable Parquet file per table with the expected row counts", async () => {
    await exportDomainDataset("ecommerce", outDir);

    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    try {
      const reader = await connection.runAndReadAll(
        `SELECT count(*) AS n FROM read_parquet('${path.join(outDir, "customers.parquet").replace(/\\/g, "/")}')`,
      );
      const [row] = reader.getRowObjects();
      expect(Number(row.n)).toBe(ECOMMERCE_ROW_COUNTS.customers);
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });

  it("writes a schema.json describing every table's columns and row count", async () => {
    const description = await exportDomainDataset("ecommerce", outDir);

    const written = JSON.parse(
      await readFile(path.join(outDir, "schema.json"), "utf-8"),
    );
    expect(written).toEqual(description);

    const customersTable = description.tables.find((t) => t.name === "customers");
    expect(customersTable?.columns).toContain("customer_id");
    expect(customersTable?.rowCount).toBe(ECOMMERCE_ROW_COUNTS.customers);
    expect(customersTable?.sampleRows.length).toBeGreaterThan(0);
  });
});
