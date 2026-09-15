import { notFound } from "next/navigation";
import { modeValues } from "@/db/schema";
import { PracticeSession } from "./PracticeSession";

export default async function PracticeModePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!modeValues.includes(mode as (typeof modeValues)[number])) {
    notFound();
  }

  return <PracticeSession mode={mode as (typeof modeValues)[number]} />;
}
