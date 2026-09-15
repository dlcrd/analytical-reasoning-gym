import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { finalizePlacementSession } from "@/lib/sessions";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  attempts: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        isCorrect: z.boolean(),
        feedbackChecklist: z.unknown(),
      }),
    )
    .min(1),
});

/** Finalizes a Placement Test session: persists Attempts and sets each Mode's starting level. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const levelsByMode = await finalizePlacementSession(db, parsed.data.sessionId, parsed.data.attempts);
  return NextResponse.json({ levelsByMode });
}
