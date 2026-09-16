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

  it("defaults questionType to sql and placementEligible to true when omitted", () => {
    const result = exerciseAuthoringSchema.safeParse(validExercise());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.questionType).toBe("sql");
      expect(result.data.placementEligible).toBe(true);
    }
  });

  describe("multiple_choice question type", () => {
    function validMultipleChoice() {
      const { referenceSql: _referenceSql, ...rest } = validExercise();
      return {
        ...rest,
        id: "ecommerce-metric_lab-l4-mc-numerator",
        questionType: "multiple_choice",
        explanation: "Because the denominator must include cancelled orders too.",
        options: [
          { id: "a", label: "Completed orders only" },
          { id: "b", label: "All orders regardless of status" },
        ],
        correctOptionId: "b",
      };
    }

    it("accepts a well-formed multiple_choice exercise with no referenceSql", () => {
      const result = exerciseAuthoringSchema.safeParse(validMultipleChoice());
      expect(result.success).toBe(true);
    });

    it("rejects when correctOptionId doesn't match any option", () => {
      const result = exerciseAuthoringSchema.safeParse({
        ...validMultipleChoice(),
        correctOptionId: "does-not-exist",
      });
      expect(result.success).toBe(false);
    });

    it("rejects when referenceSql is present on a non-sql question", () => {
      const result = exerciseAuthoringSchema.safeParse({
        ...validMultipleChoice(),
        referenceSql: "select 1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects when explanation is missing", () => {
      const { explanation: _explanation, ...rest } = validMultipleChoice();
      const result = exerciseAuthoringSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe("ordering question type", () => {
    function validOrdering() {
      const { referenceSql: _referenceSql, ...rest } = validExercise();
      return {
        ...rest,
        id: "ecommerce-query_architecture-l4-ordering-pipeline",
        questionType: "ordering",
        explanation: "Filter before aggregating, then apply the window function last.",
        steps: [
          { id: "filter", label: "Filter to completed orders" },
          { id: "aggregate", label: "Aggregate revenue by month" },
          { id: "window", label: "Apply LAG to compute growth" },
        ],
        correctOrder: ["filter", "aggregate", "window"],
      };
    }

    it("accepts a well-formed ordering exercise", () => {
      const result = exerciseAuthoringSchema.safeParse(validOrdering());
      expect(result.success).toBe(true);
    });

    it("rejects when correctOrder isn't a permutation of the steps' ids", () => {
      const result = exerciseAuthoringSchema.safeParse({
        ...validOrdering(),
        correctOrder: ["filter", "aggregate"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("budget question type", () => {
    function validBudget() {
      const { referenceSql: _referenceSql, ...rest } = validExercise();
      return {
        ...rest,
        id: "ecommerce-sql_build-l4-budget-refund-spike",
        questionType: "budget",
        explanation: "Checking refund reason codes was the cheapest way to confirm the cause.",
        budgetAmount: 10,
        investigations: [
          { id: "reason_codes", label: "Check refund reason codes", cost: 3, revealText: "Most refunds cite 'defective item'." },
          { id: "channel_mix", label: "Check channel mix", cost: 5, revealText: "Channel mix is stable." },
        ],
        recommendationOptions: [
          { id: "defect", label: "Escalate to product quality" },
          { id: "pricing", label: "Escalate to pricing" },
        ],
        correctRecommendationOptionId: "defect",
      };
    }

    it("accepts a well-formed budget exercise", () => {
      const result = exerciseAuthoringSchema.safeParse(validBudget());
      expect(result.success).toBe(true);
    });

    it("rejects when correctRecommendationOptionId doesn't match any recommendationOption", () => {
      const result = exerciseAuthoringSchema.safeParse({
        ...validBudget(),
        correctRecommendationOptionId: "does-not-exist",
      });
      expect(result.success).toBe(false);
    });
  });
});
