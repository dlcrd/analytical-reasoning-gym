import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { admitIncomingBatches } from "../admit-batch";

const DATASETS_ROOT = path.join(process.cwd(), "public", "datasets");

function goodExercise(id: string) {
  return {
    id,
    domain: "ecommerce",
    mode: "sql_build",
    level: 3,
    skills: ["aggregation"],
    title: "Count customers",
    prompt: "How many customers do we have?",
    population: "All customers.",
    grain: "One row, total count.",
    referenceSql: "SELECT count(*) AS customer_count FROM customers",
  };
}

function badExercise(id: string) {
  return { ...goodExercise(id), referenceSql: "SELECT * FROM not_a_real_table" };
}

describe("admitIncomingBatches", () => {
  let root: string;
  let incomingDir: string;
  let validatedDir: string;
  let logFile: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "arg-exercises-"));
    incomingDir = path.join(root, "incoming");
    validatedDir = path.join(root, "validated");
    logFile = path.join(root, "generation-log.json");
    await mkdir(incomingDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("admits valid exercises to disk and records them in the generation log, and skips invalid ones", async () => {
    await writeFile(
      path.join(incomingDir, "batch-1.json"),
      JSON.stringify([goodExercise("ecommerce-sql_build-l3-a"), badExercise("ecommerce-sql_build-l3-b")]),
    );

    const summary = await admitIncomingBatches({ incomingDir, validatedDir, logFile, datasetsRoot: DATASETS_ROOT });

    expect(summary.admitted).toEqual(["ecommerce-sql_build-l3-a"]);
    expect(summary.rejected.map((r) => r.id)).toEqual(["ecommerce-sql_build-l3-b"]);

    const validatedFile = JSON.parse(
      await readFile(path.join(validatedDir, "ecommerce-sql_build-l3-a.json"), "utf-8"),
    );
    expect(validatedFile.id).toBe("ecommerce-sql_build-l3-a");
    expect(validatedFile.admittedAt).toBeTruthy();

    const log = JSON.parse(await readFile(logFile, "utf-8"));
    expect(log.map((e: { id: string }) => e.id)).toEqual(["ecommerce-sql_build-l3-a"]);
  });

  it("archives a processed batch file instead of leaving it in incoming/", async () => {
    await writeFile(
      path.join(incomingDir, "batch-1.json"),
      JSON.stringify([goodExercise("ecommerce-sql_build-l3-a")]),
    );

    await admitIncomingBatches({ incomingDir, validatedDir, logFile, datasetsRoot: DATASETS_ROOT });

    await expect(access(path.join(incomingDir, "batch-1.json"))).rejects.toThrow();
    await expect(
      access(path.join(incomingDir, "processed", "batch-1.json")),
    ).resolves.toBeUndefined();
  });

  it("rejects an id on a later run that the log already shows as admitted", async () => {
    await writeFile(
      path.join(incomingDir, "batch-1.json"),
      JSON.stringify([goodExercise("ecommerce-sql_build-l3-a")]),
    );
    await admitIncomingBatches({ incomingDir, validatedDir, logFile, datasetsRoot: DATASETS_ROOT });

    await writeFile(
      path.join(incomingDir, "batch-2.json"),
      JSON.stringify([goodExercise("ecommerce-sql_build-l3-a")]),
    );
    const secondRun = await admitIncomingBatches({ incomingDir, validatedDir, logFile, datasetsRoot: DATASETS_ROOT });

    expect(secondRun.admitted).toEqual([]);
    expect(secondRun.rejected[0].errors.join(" ")).toMatch(/already admitted/i);
  });
});
