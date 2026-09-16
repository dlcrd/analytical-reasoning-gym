import type { ComparisonResult } from "./grading";

/** Grades a Placement Test multiple_choice question. Never reveals the correct option id in `reason`. */
export function gradeMultipleChoice(selectedOptionId: string, correctOptionId: string): ComparisonResult {
  if (selectedOptionId === correctOptionId) return { matches: true };
  return { matches: false, reason: "the selected option is not correct" };
}

/** Grades a Placement Test ordering question — the submitted order must match exactly, no partial credit. */
export function gradeOrdering(submittedOrder: string[], correctOrder: string[]): ComparisonResult {
  const matches =
    submittedOrder.length === correctOrder.length &&
    submittedOrder.every((id, i) => id === correctOrder[i]);
  if (matches) return { matches: true };
  return { matches: false, reason: "the order does not match the expected sequence" };
}

export interface BudgetAnswer {
  selectedInvestigationIds: string[];
  recommendationOptionId: string;
}

export interface BudgetExercise {
  budgetAmount: number;
  investigations: Array<{ id: string; cost: number }>;
  correctRecommendationOptionId: string;
}

/**
 * Grades a Placement Test budget/investigation question: the recommendation must be correct
 * AND the chosen investigations must fit within budget. Cost is recomputed here from the
 * exercise's own investigations — a client-reported total is never trusted.
 */
export function gradeBudget(answer: BudgetAnswer, exercise: BudgetExercise): ComparisonResult {
  const totalCost = exercise.investigations
    .filter((investigation) => answer.selectedInvestigationIds.includes(investigation.id))
    .reduce((sum, investigation) => sum + investigation.cost, 0);

  if (totalCost > exercise.budgetAmount) {
    return { matches: false, reason: "the chosen investigations exceed the budget" };
  }
  if (answer.recommendationOptionId !== exercise.correctRecommendationOptionId) {
    return { matches: false, reason: "the recommendation is not correct" };
  }
  return { matches: true };
}
