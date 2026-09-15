CREATE TYPE "public"."domain_slug" AS ENUM('ecommerce', 'saas', 'fintech');--> statement-breakpoint
CREATE TYPE "public"."mode" AS ENUM('metric_lab', 'granularity_trainer', 'query_architecture', 'sql_build');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('placement', 'practice');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"feedback_checklist" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "datasets_domainId_unique" UNIQUE("domain_id"),
	CONSTRAINT "datasets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "domain_slug" NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "domains_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "exercise_skills" (
	"exercise_id" text NOT NULL,
	"skill_key" text NOT NULL,
	CONSTRAINT "exercise_skills_exercise_id_skill_key_pk" PRIMARY KEY("exercise_id","skill_key")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"mode" "mode" NOT NULL,
	"domain_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"reference_sql" text NOT NULL,
	"validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_level_range" CHECK ("exercises"."level" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "mode_progress" (
	"mode" "mode" PRIMARY KEY NOT NULL,
	"current_level" integer NOT NULL,
	"level_streak" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mode_progress_level_range" CHECK ("mode_progress"."current_level" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "session_type" NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_skills" ADD CONSTRAINT "exercise_skills_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_skills" ADD CONSTRAINT "exercise_skills_skill_key_skills_key_fk" FOREIGN KEY ("skill_key") REFERENCES "public"."skills"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;