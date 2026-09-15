import { NextResponse } from "next/server";
import { z } from "zod";
import { gradeAttempt } from "@/lib/server-grading";

const bodySchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
});

/** Grades a student's already-executed query result against an exercise's referenceSql. See docs/adr/0005. */
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
    throw error;
  }
}
