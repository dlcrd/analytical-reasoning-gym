import { describe, expect, it, vi } from "vitest";

const multipleChoiceExercise = {
  id: "ecommerce-metric_lab-l4-mc-numerator",
  domain: "ecommerce",
  questionType: "multiple_choice",
  options: [
    { id: "a", label: "Completed orders only" },
    { id: "b", label: "All orders regardless of status" },
  ],
  correctOptionId: "b",
};

const orderingExercise = {
  id: "ecommerce-query_architecture-l4-ordering-pipeline",
  domain: "ecommerce",
  questionType: "ordering",
  steps: [
    { id: "filter", label: "Filter to completed orders" },
    { id: "aggregate", label: "Aggregate revenue by month" },
  ],
  correctOrder: ["filter", "aggregate"],
};

const budgetExercise = {
  id: "ecommerce-sql_build-l4-budget-refund-spike",
  domain: "ecommerce",
  questionType: "budget",
  budgetAmount: 10,
  investigations: [{ id: "reason_codes", cost: 3 }],
  recommendationOptions: [
    { id: "defect", label: "Escalate to product quality" },
    { id: "pricing", label: "Escalate to pricing" },
  ],
  correctRecommendationOptionId: "defect",
};

const exercisesById: Record<string, unknown> = {
  [multipleChoiceExercise.id]: multipleChoiceExercise,
  [orderingExercise.id]: orderingExercise,
  [budgetExercise.id]: budgetExercise,
};

vi.mock("../exercises", () => ({
  getExerciseById: vi.fn(async (id: string) => exercisesById[id]),
}));

describe("gradeAttempt dispatch by questionType", () => {
  it("grades a multiple_choice answer without ever touching DuckDB", async () => {
    const { gradeAttempt } = await import("../server-grading");
    const result = await gradeAttempt(multipleChoiceExercise.id, {
      type: "multiple_choice",
      selectedOptionId: "b",
    });
    expect(result.matches).toBe(true);
  });

  it("grades an ordering answer", async () => {
    const { gradeAttempt } = await import("../server-grading");
    const result = await gradeAttempt(orderingExercise.id, {
      type: "ordering",
      submittedOrder: ["aggregate", "filter"],
    });
    expect(result.matches).toBe(false);
  });

  it("grades a budget answer", async () => {
    const { gradeAttempt } = await import("../server-grading");
    const result = await gradeAttempt(budgetExercise.id, {
      type: "budget",
      selectedInvestigationIds: ["reason_codes"],
      recommendationOptionId: "defect",
    });
    expect(result.matches).toBe(true);
  });

  it("rejects an answer whose type doesn't match the exercise's own questionType", async () => {
    const { gradeAttempt } = await import("../server-grading");
    await expect(
      gradeAttempt(multipleChoiceExercise.id, { type: "ordering", submittedOrder: ["a", "b"] }),
    ).rejects.toThrow(/questionType/);
  });
});
