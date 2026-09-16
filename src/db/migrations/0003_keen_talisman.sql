CREATE TYPE "public"."question_type" AS ENUM('sql', 'multiple_choice', 'ordering', 'budget');--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "reference_sql" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "question_type" "question_type" DEFAULT 'sql' NOT NULL;