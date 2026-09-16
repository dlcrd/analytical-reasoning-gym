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
 * Question formats beyond plain SQL-writing, used so far only by the Placement Test (see
 * claude/v1-escopo-decisoes.md and the PRD's "Architecture Puzzle"/"Investigation Budget" modes).
 * "sql" is the only type Practice Mode ever serves.
 */
export const questionTypeValues = ["sql", "multiple_choice", "ordering", "budget"] as const;
export type QuestionType = (typeof questionTypeValues)[number];

const optionSchema = z.object({ id: z.string().min(1), label: z.string().min(1) });
const investigationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  cost: z.number().nonnegative(),
  revealText: z.string().min(1),
});

/**
 * Format for a single authored Exercise, before it has been validated against its Dataset.
 * V1 only generates levels 3-10 (L1/L2 skipped per the V1 scope doc) even though the DB
 * schema itself allows the full 1-10 scale from CONTEXT.md. Fields beyond questionType "sql"
 * (options/steps/investigations/...) are cross-checked in the .superRefine below rather than
 * a discriminated union, so one shared shape covers every type without four near-duplicate schemas.
 */
export const exerciseAuthoringSchema = z
  .object({
    id: z.string().regex(KEBAB_CASE, "id must be kebab-case"),
    domain: z.enum(domainSlugValues),
    mode: z.enum(modeValues),
    level: z.number().int().min(3).max(10),
    questionType: z.enum(questionTypeValues).default("sql"),
    /** Whether this exercise is eligible for the 16-question Placement Test pool. */
    placementEligible: z.boolean().default(true),
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
    /** Shown on the graded phase for non-sql question types, in place of population/grain/transformationPlan. */
    explanation: z.string().min(1).nullable().default(null),
    referenceSql: z.string().min(1).nullable().default(null),
    commonWrongAnswers: z
      .array(z.object({ sql: z.string().min(1), whyWrong: z.string().min(1) }))
      .default([]),
    options: z.array(optionSchema).nullable().default(null),
    correctOptionId: z.string().nullable().default(null),
    steps: z.array(optionSchema).nullable().default(null),
    correctOrder: z.array(z.string()).nullable().default(null),
    budgetAmount: z.number().positive().nullable().default(null),
    investigations: z.array(investigationSchema).nullable().default(null),
    recommendationOptions: z.array(optionSchema).nullable().default(null),
    correctRecommendationOptionId: z.string().nullable().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.questionType === "sql") {
      if (!data.referenceSql) {
        ctx.addIssue({ code: "custom", message: "referenceSql is required when questionType is sql", path: ["referenceSql"] });
      }
      return;
    }

    if (data.referenceSql) {
      ctx.addIssue({ code: "custom", message: "referenceSql must be omitted when questionType is not sql", path: ["referenceSql"] });
    }
    if (!data.explanation) {
      ctx.addIssue({ code: "custom", message: "explanation is required for non-sql question types", path: ["explanation"] });
    }

    if (data.questionType === "multiple_choice") {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({ code: "custom", message: "multiple_choice requires at least 2 options", path: ["options"] });
      } else if (!data.correctOptionId || !data.options.some((o) => o.id === data.correctOptionId)) {
        ctx.addIssue({ code: "custom", message: "correctOptionId must match one of options' ids", path: ["correctOptionId"] });
      }
    }

    if (data.questionType === "ordering") {
      if (!data.steps || data.steps.length < 2) {
        ctx.addIssue({ code: "custom", message: "ordering requires at least 2 steps", path: ["steps"] });
      } else {
        const stepIds = data.steps.map((s) => s.id);
        const order = data.correctOrder;
        const isPermutation =
          !!order &&
          order.length === stepIds.length &&
          new Set(order).size === stepIds.length &&
          order.every((id) => stepIds.includes(id));
        if (!isPermutation) {
          ctx.addIssue({ code: "custom", message: "correctOrder must be a permutation of steps' ids", path: ["correctOrder"] });
        }
      }
    }

    if (data.questionType === "budget") {
      if (data.budgetAmount == null) {
        ctx.addIssue({ code: "custom", message: "budgetAmount is required for budget questions", path: ["budgetAmount"] });
      }
      if (!data.investigations || data.investigations.length < 1) {
        ctx.addIssue({ code: "custom", message: "budget requires at least 1 investigation", path: ["investigations"] });
      }
      if (!data.recommendationOptions || data.recommendationOptions.length < 2) {
        ctx.addIssue({ code: "custom", message: "budget requires at least 2 recommendationOptions", path: ["recommendationOptions"] });
      } else if (
        !data.correctRecommendationOptionId ||
        !data.recommendationOptions.some((o) => o.id === data.correctRecommendationOptionId)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "correctRecommendationOptionId must match one of recommendationOptions' ids",
          path: ["correctRecommendationOptionId"],
        });
      }
    }
  });

export type ExerciseAuthoring = z.infer<typeof exerciseAuthoringSchema>;

export const exerciseBatchSchema = z.array(exerciseAuthoringSchema);
