import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @duckdb/node-api's native bindings resolve per-platform requires that the bundler
  // can't statically analyze — run it as a real Node dependency instead of bundling it.
  serverExternalPackages: ["@duckdb/node-api"],
  // Next's file tracer can't follow @duckdb/node-bindings' platform-dependent require()
  // either, so it silently drops the compiled .so from the serverless function output —
  // force it in for the one route that actually runs server-side grading (see
  // docs/adr/0005-grading-runs-server-side-against-reference-sql.md).
  outputFileTracingIncludes: {
    "/api/exercises/[id]/grade": [
      "./node_modules/@duckdb/node-bindings-linux-x64/**/*",
      "./node_modules/@duckdb/node-bindings/**/*",
      "./node_modules/@duckdb/node-api/**/*",
    ],
  },
};

export default nextConfig;
