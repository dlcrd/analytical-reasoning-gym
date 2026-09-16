import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { recordPlacementAttempt } from "@/lib/sessions";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().min(1),
  isCorrect: z.boolean(),
  feedbackChecklist: z.unknown(),
});

/**
 * Persists a single Placement Test Attempt immediately, as it's answered — see
 * src/lib/sessions.ts's recordPlacementAttempt. This (not a batch at the end) is what makes
 * the Placement Test resumable after closing the browser mid-test.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  try {
    await recordPlacementAttempt(db, parsed.data.sessionId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("unknown exercise")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
