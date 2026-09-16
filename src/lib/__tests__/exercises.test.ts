import { describe, expect, it } from "vitest";
import { modeValues } from "@/db/schema";
import {
  getExerciseById,
  getExercisesByModeAndLevel,
  getPlacementTestExercises,
} from "../exercises";

describe("getExercisesByModeAndLevel", () => {
  it("returns only exercises matching both the mode and the level", async () => {
    const results = await getExercisesByModeAndLevel("sql_build", 5);

    expect(results.length).toBeGreaterThan(0);
    for (const exercise of results) {
      expect(exercise.mode).toBe("sql_build");
      expect(exercise.level).toBe(5);
    }
  });

  it("returns an empty array when nothing matches", async () => {
    const results = await getExercisesByModeAndLevel("sql_build", 1);
    expect(results).toEqual([]);
  });

  it("only returns sql questionType exercises — Practice Mode has no UI for the closed formats", async () => {
    const results = await getExercisesByModeAndLevel("sql_build", 5);
    expect(results.every((exercise) => exercise.questionType === "sql")).toBe(true);
  });
});

describe("getExerciseById", () => {
  it("finds a known admitted exercise by id", async () => {
    const exercise = await getExerciseById("ecommerce-sql_build-l3-marketplace-completed-orders");
    expect(exercise?.domain).toBe("ecommerce");
    expect(exercise?.referenceSql).toContain("orders");
  });

  it("returns undefined for an unknown id", async () => {
    const exercise = await getExerciseById("does-not-exist");
    expect(exercise).toBeUndefined();
  });
});

describe("getPlacementTestExercises", () => {
  it("returns 12-16 exercises at level 4 or 5, spanning all 4 modes", async () => {
    const exercises = await getPlacementTestExercises();

    expect(exercises.length).toBeGreaterThanOrEqual(12);
    expect(exercises.length).toBeLessThanOrEqual(16);
    for (const exercise of exercises) {
      expect([4, 5]).toContain(exercise.level);
    }
    const modesCovered = new Set(exercises.map((e) => e.mode));
    expect(modesCovered).toEqual(new Set(modeValues));
  });
});
