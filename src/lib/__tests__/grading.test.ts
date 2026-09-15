import { describe, expect, it } from "vitest";
import { compareResultSets } from "../grading";

describe("compareResultSets", () => {
  it("matches identical rows given in a different order", () => {
    const actual = { columns: ["channel", "n"], rows: [["web", 10], ["app", 5]] };
    const expected = { columns: ["channel", "n"], rows: [["app", 5], ["web", 10]] };

    expect(compareResultSets(actual, expected).matches).toBe(true);
  });

  it("flags a row count mismatch", () => {
    const actual = { columns: ["n"], rows: [[1], [2]] };
    const expected = { columns: ["n"], rows: [[1]] };

    const result = compareResultSets(actual, expected);
    expect(result.matches).toBe(false);
    expect(result.reason).toMatch(/row/i);
  });

  it("flags a value mismatch with the same row count", () => {
    const actual = { columns: ["n"], rows: [[1], [2]] };
    const expected = { columns: ["n"], rows: [[1], [3]] };

    expect(compareResultSets(actual, expected).matches).toBe(false);
  });

  it("tolerates tiny floating-point rounding differences", () => {
    const actual = { columns: ["rate"], rows: [[0.3333333333333333]] };
    const expected = { columns: ["rate"], rows: [[1 / 3]] };

    expect(compareResultSets(actual, expected).matches).toBe(true);
  });

  it("does not tolerate a real difference disguised as a float", () => {
    const actual = { columns: ["rate"], rows: [[0.5]] };
    const expected = { columns: ["rate"], rows: [[0.6]] };

    expect(compareResultSets(actual, expected).matches).toBe(false);
  });

  it("treats null and undefined as equal", () => {
    const actual = { columns: ["v"], rows: [[null]] };
    const expected = { columns: ["v"], rows: [[undefined]] };

    expect(compareResultSets(actual, expected).matches).toBe(true);
  });

  it("matches two empty result sets", () => {
    const actual = { columns: ["n"], rows: [] };
    const expected = { columns: ["n"], rows: [] };

    expect(compareResultSets(actual, expected).matches).toBe(true);
  });

  it("normalizes Date values to the same instant for comparison", () => {
    const actual = { columns: ["d"], rows: [[new Date("2025-01-01T00:00:00.000Z")]] };
    const expected = { columns: ["d"], rows: [["2025-01-01T00:00:00.000Z"]] };

    expect(compareResultSets(actual, expected).matches).toBe(true);
  });
});
