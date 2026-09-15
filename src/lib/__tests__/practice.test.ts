import { describe, expect, it } from "vitest";
import { nextPracticeProgress } from "../practice";

describe("nextPracticeProgress", () => {
  it("increments the streak on a correct answer without advancing the level yet", () => {
    const result = nextPracticeProgress({ currentLevel: 4, levelStreak: 0 }, true);
    expect(result).toEqual({ currentLevel: 4, levelStreak: 1 });
  });

  it("advances the level and resets the streak after 2 correct answers in a row", () => {
    const result = nextPracticeProgress({ currentLevel: 4, levelStreak: 1 }, true);
    expect(result).toEqual({ currentLevel: 5, levelStreak: 0 });
  });

  it("resets the streak on a miss without lowering the level", () => {
    const result = nextPracticeProgress({ currentLevel: 6, levelStreak: 1 }, false);
    expect(result).toEqual({ currentLevel: 6, levelStreak: 0 });
  });

  it("never advances past level 10", () => {
    const result = nextPracticeProgress({ currentLevel: 10, levelStreak: 1 }, true);
    expect(result).toEqual({ currentLevel: 10, levelStreak: 0 });
  });
});
