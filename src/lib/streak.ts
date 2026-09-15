const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive-days-of-activity streak (per claude/v1-escopo-decisoes.md's "streak simples").
 * Counts back from `now`; if there's no activity yet today, the streak is still alive as long
 * as yesterday has activity (a day only "breaks" the streak once it ends with nothing logged).
 */
export function computeCurrentStreak(activityDates: Date[], now: Date = new Date()): number {
  const activeDays = new Set(activityDates.map(toDateKey));

  let cursor = now;
  if (!activeDays.has(toDateKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  let streak = 0;
  while (activeDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}
