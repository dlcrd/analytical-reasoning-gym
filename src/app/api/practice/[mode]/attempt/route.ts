import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { recordPracticeAttempt } from "@/lib/sessions";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().min(1),
  isCorrect: z.boolean(),
  feedbackChecklist: z.unknown(),
});

/** Records one Practice Mode attempt and returns the mode's updated progress. See src/lib/sessions.ts. */
export async function POST(request: Request, { params }: { params: Promise<{ mode: string }> }) {
  await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  try {
    const result = await recordPracticeAttempt(db, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("unknown exercise")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
