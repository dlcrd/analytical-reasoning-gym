/** Validated by a throwaway data-flow prototype (scripts/prototypes/, since deleted) against real exercises/datasets. */

export interface PlacementTally {
  /** out of the 2 L4 Placement Test exercises for this Mode */
  level4Correct: number;
  /** out of the 2 L5 Placement Test exercises for this Mode */
  level5Correct: number;
}

/**
 * Derives a Mode's starting current_level from its 4 Placement Test attempts (2 at L4, 2 at L5).
 * Both L5 correct -> start at L5 (the highest level actually tested). At least one L4 correct
 * (but L5 not secured) -> start at L4. Neither L4 correct -> start at the V1 floor, L3. Never
 * places above L5 or below L3 — those are the bounds of what the Placement Test actually tests.
 */
export function derivePlacementLevel(tally: PlacementTally): number {
  if (tally.level5Correct >= 2) return 5;
  if (tally.level4Correct >= 1) return 4;
  return 3;
}
