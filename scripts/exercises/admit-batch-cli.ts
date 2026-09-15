import path from "node:path";
import { admitIncomingBatches } from "./admit-batch";

async function main() {
  const contentRoot = path.join(process.cwd(), "content", "exercises");
  const summary = await admitIncomingBatches({
    incomingDir: path.join(contentRoot, "incoming"),
    validatedDir: path.join(contentRoot, "validated"),
    logFile: path.join(contentRoot, "generation-log.json"),
    datasetsRoot: path.join(process.cwd(), "public", "datasets"),
  });

  for (const id of summary.admitted) {
    console.log(`✓ admitted ${id}`);
  }
  for (const result of summary.rejected) {
    console.log(`✗ rejected ${result.id}`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  console.log(`\n${summary.admitted.length} admitted, ${summary.rejected.length} rejected.`);
}

main();
