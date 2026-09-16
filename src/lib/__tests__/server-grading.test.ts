import { describe, expect, it } from "vitest";
import { computeReferenceResult, gradeAttempt } from "../server-grading";

const KNOWN_EXERCISE_ID = "ecommerce-sql_build-l3-marketplace-completed-orders";

describe("gradeAttempt", () => {
  it("matches when the student's result equals the reference SQL's result", async () => {
    const expected = await computeReferenceResult(KNOWN_EXERCISE_ID);

    const result = await gradeAttempt(KNOWN_EXERCISE_ID, expected);

    expect(result.matches).toBe(true);
  });

  it("returns a generic reason without leaking expected values on a mismatch", async () => {
    const result = await gradeAttempt(KNOWN_EXERCISE_ID, {
      columns: ["marketplace_completed_orders"],
      rows: [[999999]],
    });

    expect(result.matches).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.reason).not.toContain("999999");
  });

  it("throws on an unknown exercise id", async () => {
    await expect(
      gradeAttempt("does-not-exist", { columns: [], rows: [] }),
    ).rejects.toThrow(/unknown exercise/);
  });

  it("returns a reference result with no bigint cells, so it's always JSON-serializable", async () => {
    const result = await computeReferenceResult(KNOWN_EXERCISE_ID);

    for (const row of result.rows) {
      for (const cell of row) {
        expect(typeof cell).not.toBe("bigint");
      }
    }
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
