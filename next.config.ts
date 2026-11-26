import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desktop shell runs `server.js` from this standalone bundle with a
  // bundled Node sidecar, which keeps API routes and better-sqlite3 intact.
  output: "standalone",

  // better-sqlite3 is a native module and must stay outside the bundler.
  serverExternalPackages: ["better-sqlite3"],

  // Migrations are read from disk at runtime by the startup bootstrap.
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
};

export default nextConfig;
