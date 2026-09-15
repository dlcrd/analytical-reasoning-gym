import { createDb } from "@/db/client";
import { syncExercisesIndex } from "@/db/seed-exercises";

async function main() {
  const db = await createDb();
  const result = await syncExercisesIndex(db);
  console.log(`Synced ${result.synced} exercises into the Postgres index.`);
}

main();
