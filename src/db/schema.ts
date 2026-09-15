import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  pgEnum,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const domainSlugValues = ["ecommerce", "saas", "fintech"] as const;
export const domainSlugEnum = pgEnum("domain_slug", domainSlugValues);
export type Domain = (typeof domainSlugValues)[number];

export const modeValues = [
  "metric_lab",
  "granularity_trainer",
  "query_architecture",
  "sql_build",
] as const;

export const modeEnum = pgEnum("mode", modeValues);
export type Mode = (typeof modeValues)[number];

export const sessionTypeValues = ["placement", "practice"] as const;
export const sessionTypeEnum = pgEnum("session_type", sessionTypeValues);

export const domains = pgTable("domains", {
  id: uuid().primaryKey().defaultRandom(),
  slug: domainSlugEnum().notNull().unique(),
  name: text().notNull(),
});

/** One row per domain (unique domainId) — see docs/adr/0001-one-dataset-per-domain.md. */
export const datasets = pgTable("datasets", {
  id: uuid().primaryKey().defaultRandom(),
  domainId: uuid()
    .notNull()
    .unique()
    .references(() => domains.id),
  slug: text().notNull().unique(),
  description: text().notNull(),
});

/**
 * id is the exercise's authored slug (e.g. "ecommerce-sql_build-l5-refund-rate-by-channel"),
 * not a generated uuid — it's already a stable, human-readable natural key shared with
 * content/exercises/validated/<id>.json, generation-log.json, and the authoring prompt.
 * Difficulty is 1-10 on the scale in CONTEXT.md; V1 content only populates 3-10.
 */
export const exercises = pgTable(
  "exercises",
  {
    id: text().primaryKey(),
    mode: modeEnum().notNull(),
    domainId: uuid()
      .notNull()
      .references(() => domains.id),
    level: integer().notNull(),
    title: text().notNull(),
    prompt: text().notNull(),
    referenceSql: text().notNull(),
    validatedAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [check("exercises_level_range", sql`${table.level} between 1 and 10`)],
);

/** key is the fixed skill-taxonomy slug (e.g. "grain", "denominator") — see scripts/exercises/exercise-schema.ts's SKILL_KEYS. Its own natural key; no separate generated id. */
export const skills = pgTable("skills", {
  key: text().primaryKey(),
  label: text().notNull(),
});

export const exerciseSkills = pgTable(
  "exercise_skills",
  {
    exerciseId: text()
      .notNull()
      .references(() => exercises.id),
    skillKey: text()
      .notNull()
      .references(() => skills.key),
  },
  (table) => [primaryKey({ columns: [table.exerciseId, table.skillKey] })],
);

export const sessions = pgTable("sessions", {
  id: uuid().primaryKey().defaultRandom(),
  type: sessionTypeEnum().notNull(),
  startedAt: timestamp().notNull().defaultNow(),
  completedAt: timestamp(),
});

/** No "isUnaided"/"hintUsed" column: V1 has no hints, so every correct attempt is unaided by definition. */
export const attempts = pgTable("attempts", {
  id: uuid().primaryKey().defaultRandom(),
  sessionId: uuid()
    .notNull()
    .references(() => sessions.id),
  exerciseId: text()
    .notNull()
    .references(() => exercises.id),
  isCorrect: boolean().notNull(),
  feedbackChecklist: jsonb().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

/**
 * Exactly one row per mode (seeded by migration 0001_seed_mode_progress), never inserted by app code.
 * currentLevel is overwritten by the placement test result on first use.
 */
export const modeProgress = pgTable(
  "mode_progress",
  {
    mode: modeEnum().primaryKey(),
    currentLevel: integer().notNull(),
    levelStreak: integer().notNull().default(0),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    check("mode_progress_level_range", sql`${table.currentLevel} between 1 and 10`),
  ],
);
