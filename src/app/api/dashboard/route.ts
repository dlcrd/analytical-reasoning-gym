import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { computeDashboard } from "@/lib/dashboard";

/** Everything the Dashboard screen needs: streak, per-skill accuracy, and each mode's current level. */
export async function GET() {
  const db = await getDb();
  const dashboard = await computeDashboard(db);
  return NextResponse.json(dashboard);
}
