import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { startPlacementSession } from "@/lib/sessions";

/** Starts the one-time Placement Test session. See src/lib/sessions.ts. */
export async function POST() {
  const db = await getDb();
  const result = await startPlacementSession(db);
  return NextResponse.json(result);
}
