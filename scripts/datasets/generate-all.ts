import path from "node:path";
import { exportAllDatasets } from "./export";

async function main() {
  // public/ so the browser's DuckDB-WASM runner can fetch these as static assets.
  const outRoot = path.join(process.cwd(), "public", "datasets");
  const results = await exportAllDatasets(outRoot);
  for (const result of results) {
    const summary = result.tables.map((t) => `${t.name}(${t.rowCount})`).join(", ");
    console.log(`${result.domain}: ${summary}`);
  }
}

main();
