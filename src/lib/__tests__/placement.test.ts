import { describe, expect, it } from "vitest";
import { derivePlacementLevel } from "../placement";

describe("derivePlacementLevel", () => {
  it("places at L5 when both L5 attempts are correct, regardless of L4", () => {
    expect(derivePlacementLevel({ level4Correct: 0, level5Correct: 2 })).toBe(5);
    expect(derivePlacementLevel({ level4Correct: 2, level5Correct: 2 })).toBe(5);
  });

  it("places at L4 when at least one L4 attempt is correct but L5 isn't secured", () => {
    expect(derivePlacementLevel({ level4Correct: 1, level5Correct: 0 })).toBe(4);
    expect(derivePlacementLevel({ level4Correct: 2, level5Correct: 1 })).toBe(4);
  });

  it("falls back to the V1 floor, L3, when no L4 attempt is correct", () => {
    expect(derivePlacementLevel({ level4Correct: 0, level5Correct: 0 })).toBe(3);
  });
});
