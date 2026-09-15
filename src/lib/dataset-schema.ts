import type { Domain } from "@/db/schema";
import type { DomainSchemaDescription } from "../../scripts/datasets/export";

const cache = new Map<Domain, Promise<DomainSchemaDescription>>();

/**
 * Fetches (and caches per domain) the table/column schema description served
 * alongside each domain's Parquet datasets, for display in the SQL editor.
 *
 * Args:
 *     domain: The exercise's domain (e-commerce, SaaS, fintech).
 *
 * Returns:
 *     The domain's schema description (table names, columns, sample rows).
 */
export function getDomainSchema(domain: Domain): Promise<DomainSchemaDescription> {
  let cached = cache.get(domain);
  if (!cached) {
    cached = fetch(`/datasets/${domain}/schema.json`).then((response) => response.json());
    cache.set(domain, cached);
  }
  return cached;
}
