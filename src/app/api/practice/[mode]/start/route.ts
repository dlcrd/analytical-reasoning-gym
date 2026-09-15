import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { modeValues } from "@/db/schema";
import { startPracticeSession } from "@/lib/sessions";

const modeSchema = z.enum(modeValues);

/** Starts a Practice Mode session for the Mode in the URL. See src/lib/sessions.ts. */
export async function POST(_request: Request, { params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const parsed = modeSchema.safeParse(mode);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();
  const result = await startPracticeSession(db, parsed.data);
  return NextResponse.json(result);
}
