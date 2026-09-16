import { describe, expect, it } from "vitest";
import { gradeBudget, gradeMultipleChoice, gradeOrdering } from "../closed-question-grading";

describe("gradeMultipleChoice", () => {
  it("matches when the selected option is correct", () => {
    expect(gradeMultipleChoice("b", "b").matches).toBe(true);
  });

  it("doesn't match and never leaks the correct option id in the reason", () => {
    const result = gradeMultipleChoice("a", "b");
    expect(result.matches).toBe(false);
    expect(result.reason).not.toContain("b");
  });
});

describe("gradeOrdering", () => {
  it("matches when the submitted order equals the correct order exactly", () => {
    expect(gradeOrdering(["filter", "aggregate", "window"], ["filter", "aggregate", "window"]).matches).toBe(
      true,
    );
  });

  it("doesn't match on a different order, even with the same steps", () => {
    const result = gradeOrdering(["aggregate", "filter", "window"], ["filter", "aggregate", "window"]);
    expect(result.matches).toBe(false);
  });

  it("doesn't match when lengths differ", () => {
    const result = gradeOrdering(["filter"], ["filter", "aggregate"]);
    expect(result.matches).toBe(false);
  });
});

describe("gradeBudget", () => {
  const exercise = {
    budgetAmount: 10,
    investigations: [
      { id: "reason_codes", cost: 3 },
      { id: "channel_mix", cost: 5 },
      { id: "everything", cost: 20 },
    ],
    correctRecommendationOptionId: "defect",
  };

  it("matches when the recommendation is correct and the spend stays within budget", () => {
    const result = gradeBudget(
      { selectedInvestigationIds: ["reason_codes"], recommendationOptionId: "defect" },
      exercise,
    );
    expect(result.matches).toBe(true);
  });

  it("fails when the recommendation is wrong even if within budget", () => {
    const result = gradeBudget(
      { selectedInvestigationIds: ["reason_codes"], recommendationOptionId: "pricing" },
      exercise,
    );
    expect(result.matches).toBe(false);
  });

  it("fails when the chosen investigations exceed the budget, even with the right recommendation", () => {
    const result = gradeBudget(
      { selectedInvestigationIds: ["everything"], recommendationOptionId: "defect" },
      exercise,
    );
    expect(result.matches).toBe(false);
  });

  it("recomputes cost from the exercise's own investigations, never trusting a client-provided total", () => {
    // Selecting an unknown investigation id contributes 0 cost server-side, not whatever the client claims.
    const result = gradeBudget(
      { selectedInvestigationIds: ["reason_codes", "does-not-exist"], recommendationOptionId: "defect" },
      exercise,
    );
    expect(result.matches).toBe(true);
  });
});
