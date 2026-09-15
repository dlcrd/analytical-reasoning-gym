import * as duckdb from "@duckdb/duckdb-wasm";
import type { Domain } from "@/db/schema";
import { arrowTableToQueryResult } from "./duckdb-arrow";
import { getDomainSchema } from "./dataset-schema";
import type { QueryResult } from "./grading";

/**
 * Client-side only: boots DuckDB-WASM (bundles fetched from jsDelivr, not self-hosted — the
 * package's own default, and far simpler than vendoring ~80MB of wasm/worker files into this repo)
 * and runs SQL against a Domain's Parquet dataset in public/datasets/<domain>/. Shared by the
 * Placement Test and all 4 session modes — there is no server-side SQL sandbox in this app (see
 * CONTEXT.md's "Dataset" entry and the V1 scope doc).
 */

let dbPromise: Promise<duckdb.AsyncDuckDB> | undefined;

async function getDb(): Promise<duckdb.AsyncDuckDB> {
  dbPromise ??= (async () => {
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    const worker = await duckdb.createWorker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return db;
  })();
  return dbPromise;
}

const loadedDomains = new Set<Domain>();

async function ensureDomainLoaded(db: duckdb.AsyncDuckDB, domain: Domain): Promise<void> {
  if (loadedDomains.has(domain)) return;

  const schema = await getDomainSchema(domain);

  const connection = await db.connect();
  try {
    for (const table of schema.tables) {
      const registeredName = `${domain}__${table.name}`;
      // Must be absolute: DuckDB-WASM resolves this URL from inside its worker, whose
      // location is the CDN-hosted worker script, not this page — a relative path
      // resolves against the wrong origin and fails to fetch.
      const absoluteUrl = new URL(`/datasets/${domain}/${table.name}.parquet`, window.location.origin).toString();
      await db.registerFileURL(registeredName, absoluteUrl, duckdb.DuckDBDataProtocol.HTTP, false);
      await connection.query(
        `CREATE VIEW IF NOT EXISTS ${table.name} AS SELECT * FROM read_parquet('${registeredName}')`,
      );
    }
  } finally {
    await connection.close();
  }

  loadedDomains.add(domain);
}

/** Runs `sql` against `domain`'s dataset, loading it into DuckDB-WASM on first use. */
export async function runSql(domain: Domain, sql: string): Promise<QueryResult> {
  const db = await getDb();
  await ensureDomainLoaded(db, domain);

  const connection = await db.connect();
  try {
    const table = await connection.query(sql);
    return arrowTableToQueryResult(table);
  } finally {
    await connection.close();
  }
}
