import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @duckdb/node-api's native bindings resolve per-platform requires that the bundler
  // can't statically analyze — run it as a real Node dependency instead of bundling it.
  serverExternalPackages: ["@duckdb/node-api"],
};

export default nextConfig;
