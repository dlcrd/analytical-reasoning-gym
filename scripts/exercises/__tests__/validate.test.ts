import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateExercises } from "../validate";

const DATASETS_ROOT = path.join(process.cwd(), "public", "datasets");

function baseExercise(overrides: Record<string, unknown> = {}) {
  return {
    id: "ecommerce-sql_build-l3-customer-count",
    domain: "ecommerce",
    mode: "sql_build",
    level: 3,
    skills: ["aggregation"],
    title: "Count customers",
    prompt: "How many customers do we have?",
    population: "All customers.",
    grain: "One row, total count.",
    referenceSql: "SELECT count(*) AS customer_count FROM customers",
    ...overrides,
  };
}

describe("validateExercises", () => {
  it("admits an exercise whose reference SQL runs cleanly against its domain's dataset", async () => {
    const [result] = await validateExercises([baseExercise()], { datasetsRoot: DATASETS_ROOT });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an exercise whose reference SQL fails against the dataset", async () => {
    const [result] = await validateExercises(
      [baseExercise({ id: "ecommerce-sql_build-l3-bad-sql", referenceSql: "SELECT * FROM not_a_real_table" })],
      { datasetsRoot: DATASETS_ROOT },
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/reference SQL failed/i);
  });

  it("rejects an exercise that fails the authoring schema, keeping its id for traceability", async () => {
    const [result] = await validateExercises(
      [baseExercise({ level: 99 })],
      { datasetsRoot: DATASETS_ROOT },
    );
    expect(result.valid).toBe(false);
    expect(result.id).toBe("ecommerce-sql_build-l3-customer-count");
  });

  it("flags a second exercise in the same batch that reuses an id already seen", async () => {
    const results = await validateExercises(
      [baseExercise(), baseExercise({ referenceSql: "SELECT count(*) FROM products" })],
      { datasetsRoot: DATASETS_ROOT },
    );
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[1].errors.join(" ")).toMatch(/duplicate id/i);
  });

  it("flags an id that collides with one already admitted in a previous batch", async () => {
    const [result] = await validateExercises([baseExercise()], {
      datasetsRoot: DATASETS_ROOT,
      alreadyAdmittedIds: new Set(["ecommerce-sql_build-l3-customer-count"]),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/already admitted/i);
  });
});
