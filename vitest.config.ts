import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Several suites boot an embedded Postgres (pglite) or DuckDB per test; cold starts
    // can be slow when many test files run concurrently.
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/db/migrations/**", "src/**/__tests__/**"],
    },
  },
});
