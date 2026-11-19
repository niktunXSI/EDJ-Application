import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  devIndicators: false,
  // Dev only: browser automation opens the dev server at 127.0.0.1, and Next.js otherwise blocks its client bundle from that origin.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    // cursor/identity.ts imports its sibling with a ".js" specifier, which Turbopack does not map to ".ts".
    resolveAlias: {
      "./identity.dev.js": "./cursor/identity.dev.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
