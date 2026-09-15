"use client";

import { useEffect, useState } from "react";
import type { Domain } from "@/db/schema";
import { getDomainSchema } from "@/lib/dataset-schema";
import type { DomainSchemaDescription } from "../../scripts/datasets/export";

/** Shows the dataset's table and column names so the student doesn't have to guess them. */
export function SchemaPanel({ domain }: { domain: Domain }) {
  const [schema, setSchema] = useState<DomainSchemaDescription | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDomainSchema(domain).then((data) => {
      if (!cancelled) setSchema(data);
    });
    return () => {
      cancelled = true;
    };
  }, [domain]);

  if (!schema) return null;

  return (
    <details className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-700">
      <summary className="cursor-pointer font-medium text-zinc-900 dark:text-zinc-50">
        Schema do dataset ({domain})
      </summary>
      <div className="mt-2 flex flex-col gap-1">
        {schema.tables.map((table) => (
          <p key={table.name} className="text-zinc-700 dark:text-zinc-300">
            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-50">{table.name}</span>
            {": "}
            {table.columns.join(", ")}
          </p>
        ))}
      </div>
    </details>
  );
}
