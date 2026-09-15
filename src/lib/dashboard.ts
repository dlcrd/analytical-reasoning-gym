import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { Mode } from "@/db/schema";
import { attempts, exerciseSkills, modeProgress, skills } from "@/db/schema";
import { computeCurrentStreak } from "./streak";

export interface SkillStat {
  key: string;
  label: string;
  correct: number;
  total: number;
  accuracy: number;
}

/** Per-skill accuracy across every Attempt ever made — the "weakest skills" bars from the PRD's Skill Graph. */
export async function computeSkillStats(db: Db): Promise<SkillStat[]> {
  const rows = await db
    .select({ key: skills.key, label: skills.label, isCorrect: attempts.isCorrect })
    .from(exerciseSkills)
    .innerJoin(skills, eq(skills.key, exerciseSkills.skillKey))
    .innerJoin(attempts, eq(attempts.exerciseId, exerciseSkills.exerciseId));

  const byKey = new Map<string, { label: string; correct: number; total: number }>();
  for (const row of rows) {
    const entry = byKey.get(row.key) ?? { label: row.label, correct: 0, total: 0 };
    entry.total += 1;
    if (row.isCorrect) entry.correct += 1;
    byKey.set(row.key, entry);
  }

  return [...byKey.entries()]
    .map(([key, { label, correct, total }]) => ({
      key,
      label,
      correct,
      total,
      accuracy: total > 0 ? correct / total : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Consecutive-days streak derived from every Attempt's timestamp. See streak.ts. */
export async function getCurrentStreakDays(db: Db, now: Date = new Date()): Promise<number> {
  const rows = await db.select({ createdAt: attempts.createdAt }).from(attempts);
  return computeCurrentStreak(
    rows.map((row) => row.createdAt),
    now,
  );
}

export interface Dashboard {
  streakDays: number;
  skills: SkillStat[];
  levelsByMode: Record<Mode, number>;
}

/** Everything the Home/Dashboard screen needs: streak, skill bars, and each mode's current level. */
export async function computeDashboard(db: Db, now: Date = new Date()): Promise<Dashboard> {
  const [streakDays, skillStats, progressRows] = await Promise.all([
    getCurrentStreakDays(db, now),
    computeSkillStats(db),
    db.select().from(modeProgress),
  ]);

  const levelsByMode = {} as Record<Mode, number>;
  for (const row of progressRows) {
    levelsByMode[row.mode] = row.currentLevel;
  }

  return { streakDays, skills: skillStats, levelsByMode };
}
