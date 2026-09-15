import { describe, expect, it } from "vitest";
import { exerciseAuthoringSchema } from "../exercise-schema";

function validExercise() {
  return {
    id: "ecommerce-sql_build-l5-refund-rate",
    domain: "ecommerce",
    mode: "sql_build",
    level: 5,
    skills: ["aggregation", "denominator"],
    title: "Refund rate by channel",
    prompt: "Given the orders and payments tables, ...",
    population: "Orders placed in 2025, regardless of channel.",
    grain: "One row per order.",
    metricDefinition: "refunded orders / total orders, per channel.",
    transformationPlan: null,
    referenceSql: "select 1",
    commonWrongAnswers: [],
  };
}

describe("exerciseAuthoringSchema", () => {
  it("accepts a well-formed exercise", () => {
    const result = exerciseAuthoringSchema.safeParse(validExercise());
    expect(result.success).toBe(true);
  });

  it("rejects a non-kebab-case id", () => {
    const result = exerciseAuthoringSchema.safeParse({
      ...validExercise(),
      id: "Ecommerce_SQL_Build_L5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a level outside the V1 content range of 3-10", () => {
    const tooLow = exerciseAuthoringSchema.safeParse({ ...validExercise(), level: 2 });
    const tooHigh = exerciseAuthoringSchema.safeParse({ ...validExercise(), level: 11 });
    expect(tooLow.success).toBe(false);
    expect(tooHigh.success).toBe(false);
  });

  it("rejects duplicate skills", () => {
    const result = exerciseAuthoringSchema.safeParse({
      ...validExercise(),
      skills: ["aggregation", "aggregation"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown skill key", () => {
    const result = exerciseAuthoringSchema.safeParse({
      ...validExercise(),
      skills: ["not_a_real_skill"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing referenceSql", () => {
    const { referenceSql: _referenceSql, ...rest } = validExercise();
    const result = exerciseAuthoringSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("defaults commonWrongAnswers to an empty array when omitted", () => {
    const { commonWrongAnswers: _commonWrongAnswers, ...rest } = validExercise();
    const result = exerciseAuthoringSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.commonWrongAnswers).toEqual([]);
    }
  });
});
