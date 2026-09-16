import { NextResponse } from "next/server";
import { z } from "zod";
import { gradeAttempt } from "@/lib/server-grading";

const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sql"), columns: z.array(z.string()), rows: z.array(z.array(z.unknown())) }),
  z.object({ type: z.literal("multiple_choice"), selectedOptionId: z.string() }),
  z.object({ type: z.literal("ordering"), submittedOrder: z.array(z.string()) }),
  z.object({
    type: z.literal("budget"),
    selectedInvestigationIds: z.array(z.string()),
    recommendationOptionId: z.string(),
  }),
]);

/**
 * Grades a student's answer against an exercise's own stored correct answer — a `referenceSql`
 * re-run server-side for questionType "sql" (see docs/adr/0005), or a direct comparison for the
 * 3 closed Placement Test formats. The exercise's questionType decides which of these applies;
 * `type` in the body must match it (checked in gradeAttempt).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await gradeAttempt(id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("unknown exercise")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("questionType")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
