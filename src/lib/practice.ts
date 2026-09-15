const MAX_LEVEL = 10;
const STREAK_TO_ADVANCE = 2;

export interface PracticeProgress {
  currentLevel: number;
  levelStreak: number;
}

/**
 * Applies one Practice attempt to a Mode's progress: advances the level (and resets the streak)
 * after 2 unaided correct answers in a row, capped at level 10; a miss resets the streak but
 * never lowers the level — see the "Leveling" rules in claude/v1-escopo-decisoes.md.
 */
export function nextPracticeProgress(prev: PracticeProgress, isCorrect: boolean): PracticeProgress {
  if (!isCorrect) {
    return { currentLevel: prev.currentLevel, levelStreak: 0 };
  }

  const streak = prev.levelStreak + 1;
  if (streak >= STREAK_TO_ADVANCE) {
    return { currentLevel: Math.min(prev.currentLevel + 1, MAX_LEVEL), levelStreak: 0 };
  }
  return { currentLevel: prev.currentLevel, levelStreak: streak };
}
