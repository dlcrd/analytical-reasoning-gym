# Analytical Reasoning Gym

Personal tool for practicing the full analytical reasoning chain (business problem → metric → population/grain → query architecture → SQL → validation), not just SQL syntax. Single user, no accounts. This file covers the whole app's domain — the operational database (Postgres) is currently the part being modeled, but pedagogical terms below apply everywhere (UI copy, exercise metadata, feedback).

## Language

### Pedagogical concepts

These are the vocabulary the app teaches, and also the vocabulary the Feedback Checklist is scored against. Get these right — they're user-facing, not just internal.

**Population**:
The precise set of rows/entities in scope for a metric before aggregation (e.g. "orders placed in Q1 by non-refunded customers"). Getting this wrong is a POPULATION error.
_Avoid_: scope, filter, dataset (Dataset is a different, DB-level concept — see below).

**Grain**:
What a single row represents at a given stage of a transformation (e.g. "one row per order" vs "one row per customer per month"). The mode named "Granularity Trainer" is a proper noun and keeps its name, but the underlying concept is always called Grain elsewhere (checklist items, code, other docs).
_Avoid_: granularity (except inside the proper noun "Granularity Trainer"), level of detail.

**Metric Definition**:
The precise formula for a business measure — numerator, denominator, and aggregation. A metric definition without an explicit denominator is incomplete.
_Avoid_: KPI, calculation, formula.

**Transformation Plan**:
The ordered sequence of steps (raw → aggregate → window → calculate) that turns source tables into the exercise's target Grain. Built in blocks before any SQL is written, in Query Architecture and Metric Lab.
_Avoid_: query plan (collides with DB execution plans), pipeline.

### Content structure

**Domain**:
The simulated business vertical an Exercise and its Dataset belong to: e-commerce, SaaS, or fintech (fixed set of 3 for V1). Purely a content-flavor axis — not related to difficulty.
_Avoid_: category, vertical, context (avoid "context" here specifically because it collides with this file's own "bounded context" sense).

**Dataset**:
The shared multi-table relational schema (loaded into DuckDB-WASM) that all Exercises of one Domain query against. One Dataset per Domain (3 total) — Exercises don't each get their own tables; they ask harder or different questions of the same shared schema. A Dataset is itself multiple related tables (e.g. e-commerce's Dataset has `orders`, `order_items`, `customers`, `products`, ...), so multi-table joins and complex pipelines are still fully available within a single Dataset. See [[0001-one-dataset-per-domain]].
_Avoid_: schema (too overloaded with SQL/DB meaning), data source.

**Mode**:
One of the four fixed pedagogical formats an Exercise is presented in: Metric Lab, Granularity Trainer, Query Architecture, SQL Build. Each Mode has its own independent [[ModeProgress]]. Note: the PRD calls these "modos de sessão" (session modes) — don't let that phrasing imply a Mode and a [[Session]] are the same thing; they aren't.
_Avoid_: session mode, exercise type, category.

**Skill**:
A specific analytical ability an Exercise exercises and is tagged with (e.g. `metric_definition`, `grain`, `aggregation`, `window_function`, `denominator`, `validation`). Many-to-many with Exercise. Feeds the per-skill progress dashboard.
_Avoid_: tag (used internally in the original PRD, but "Skill" is what's user-facing on the dashboard — pick one).

**Exercise**:
A single question: one Mode, one Domain (→ one Dataset), one difficulty Level (L3–L10 in V1), one or more Skills, a reference SQL solution, and the Feedback Checklist rubric. Must pass automated validation (reference SQL actually runs against the Dataset) before it's admitted.
_Avoid_: question, case, problem (PRD's "Case Generator" language — Exercise is the canonical term going forward).

**Level**:
An integer on a single L1–L10 difficulty scale (V1 only uses L3–L10). The *same* scale is used two ways — don't conflate them: an Exercise has one fixed Level (assigned by its author); a [[ModeProgress]] has one current Level (the user's, per Mode, moving target). An Exercise is a good fit for practice when its Level matches the user's current Level in that Exercise's Mode.

### Progress and attempts

**Session**:
A persisted grouping of one or more Attempts done in one sitting. Most Sessions are single-Mode (the user picked a Mode and started practicing); the [[Placement Test]] is the one Session type that spans all 4 Modes at once. Not the same thing as [[Mode]] — see the note under Mode.
_Avoid_: exercise session (ambiguous with Mode), round.

**Attempt**:
One submission of a solution to one Exercise, inside a Session. Holds correctness and the Feedback Checklist result. There is no "aided/unaided" distinction on an Attempt — V1 has no hint system, so every correct Attempt is unaided by definition; don't add a field for something that can't happen yet (see V1 scope doc §6).
_Avoid_: submission, answer, try.

**Feedback Checklist**:
The granular, per-step result attached to an Attempt. Only two rows are auto-graded: SQL syntax (did it run) and the final result (does its output match the Exercise's referenceSql, via `compareResultSets`). The Population/Grain/Metric Definition/Transformation Plan rows aren't compared programmatically — on a miss, the Exercise's authored prose for those fields is revealed so the student self-assesses which concept went wrong. The reference SQL itself is never revealed. Never collapses to a bare correct/incorrect. See [[0004-concept-steps-are-self-assessed-not-auto-graded]].
_Avoid_: grade, score.

**ModeProgress**:
One row per Mode (4 total, per user) holding the user's current Level in that Mode and its Level Streak. Advances independently per Mode — finishing L6 in SQL Build doesn't move Query Architecture.
_Avoid_: progress (too generic on its own), level (that's just the field name inside ModeProgress).

**Level Streak**:
The count of consecutive correct Attempts, at a ModeProgress's current Level, with no incorrect Attempt in between. Reaching 2 advances the Level and resets the Level Streak to 0. A single incorrect Attempt resets the Level Streak to 0 but never lowers the Level itself (Level never auto-regresses). This is a different concept from Daily Streak below, despite the shared English word "streak" — don't let code or copy use the bare word "streak" for either without the qualifier.
_Avoid_: streak (bare), correct streak, progress.

**Daily Streak**:
The count of consecutive calendar days on which the user completed at least one Attempt (any Mode, any Session). Pure gamification metric shown on the dashboard — has no effect on Level or Level Streak.
_Avoid_: streak (bare).

**Placement Test**:
The one-time Session (per user — meaningful once, since V1 is single-user) of 12–16 Exercises spanning all 4 Modes at ~L4/L5, taken on first use. Its Attempts set each Mode's initial current_level in ModeProgress directly; they don't count toward any Mode's Level Streak.
_Avoid_: onboarding test, diagnostic.
