import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { getActivePlacementSession } from "@/lib/sessions";

/** Returns the in-progress Placement Test session (if any) so the UI can resume it. See src/lib/sessions.ts. */
export async function GET() {
  const db = await getDb();
  const active = await getActivePlacementSession(db);
  return NextResponse.json(active);
}
