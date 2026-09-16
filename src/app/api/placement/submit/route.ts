import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { completePlacementSession } from "@/lib/sessions";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Finalizes a Placement Test session: sets each Mode's starting level from the Attempts already
 * persisted via /api/placement/attempt, and marks the session complete.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const levelsByMode = await completePlacementSession(db, parsed.data.sessionId);
  return NextResponse.json({ levelsByMode });
}
