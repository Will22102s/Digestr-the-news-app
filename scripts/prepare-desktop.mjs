#!/usr/bin/env node
/**
 * Prepare the Next.js standalone output for the Tauri bundle.
 *
 * `next build` intentionally omits `public/` and `.next/static/` from
 * `.next/standalone`, and it does not know that the SQLite bootstrap reads
 * `drizzle/` at runtime. Copy all three next to `server.js`.
 */
import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const serverFile = path.join(standalone, "server.js");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function copy(source, destination, { optional = false } = {}) {
  if (!(await exists(source))) {
    if (optional) return;
    throw new Error(`Missing required path: ${path.relative(root, source)}`);
  }
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
  console.log(
    `  ✓ ${path.relative(root, source)} → ${path.relative(root, destination)}`,
  );
}

if (!(await exists(serverFile))) {
  console.error(
    "\n  ✕ .next/standalone/server.js not found. Run `npm run build` first.\n",
  );
  process.exit(1);
}

console.log("\n  Preparing the desktop runtime\n");

await copy(path.join(root, "public"), path.join(standalone, "public"), {
  optional: true,
});
await copy(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
);
await copy(path.join(root, "drizzle"), path.join(standalone, "drizzle"));

// Keep the desktop bundle free of local development databases.
await rm(path.join(standalone, "data"), { recursive: true, force: true });

console.log("\n  ✓ Standalone runtime ready at .next/standalone\n");
