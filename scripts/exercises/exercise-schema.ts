import { z } from "zod";
import { domainSlugValues, modeValues } from "@/db/schema";

/** Skill taxonomy for the dashboard and exercise tagging — see CONTEXT.md's "Skill" entry. */
export const SKILL_KEYS = [
  "population",
  "grain",
  "metric_definition",
  "denominator",
  "filtering",
  "aggregation",
  "joins",
  "dates",
  "ctes",
  "subqueries",
  "conditional_aggregation",
  "window_function",
  "ranking",
  "running_totals",
  "rolling_windows",
  "lag_lead",
  "multi_grain",
  "complex_pipelines",
  "validation",
] as const;

// Segments are hyphen-separated but may themselves be snake_case, since ids embed
// enum values like "sql_build" or "query_architecture" verbatim.
const KEBAB_CASE = /^[a-z0-9_]+(-[a-z0-9_]+)*$/;

/**
 * Format for a single authored Exercise, before it has been validated against its Dataset.
 * V1 only generates levels 3-10 (L1/L2 skipped per the V1 scope doc) even though the DB
 * schema itself allows the full 1-10 scale from CONTEXT.md.
 */
export const exerciseAuthoringSchema = z.object({
  id: z.string().regex(KEBAB_CASE, "id must be kebab-case"),
  domain: z.enum(domainSlugValues),
  mode: z.enum(modeValues),
  level: z.number().int().min(3).max(10),
  skills: z
    .array(z.enum(SKILL_KEYS))
    .min(1)
    .refine((skills) => new Set(skills).size === skills.length, {
      message: "skills must not contain duplicates",
    }),
  title: z.string().min(1),
  prompt: z.string().min(1),
  population: z.string().min(1),
  grain: z.string().min(1),
  metricDefinition: z.string().min(1).nullable().default(null),
  transformationPlan: z.array(z.string().min(1)).nullable().default(null),
  referenceSql: z.string().min(1),
  commonWrongAnswers: z
    .array(z.object({ sql: z.string().min(1), whyWrong: z.string().min(1) }))
    .default([]),
});

export type ExerciseAuthoring = z.infer<typeof exerciseAuthoringSchema>;

export const exerciseBatchSchema = z.array(exerciseAuthoringSchema);
