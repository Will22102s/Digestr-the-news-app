import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * Resolve the SQLite file.
 *
 * Precedence:
 *  1. `DATABASE_URL` — explicit override (development and server deployments).
 *  2. `DIGEST_DATA_DIR` — the OS app-data directory injected by the Tauri
 *     desktop shell. Keeps user data outside the read-only app bundle.
 *  3. `./data/digest.db` — the default for `npm run dev`.
 */
function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_URL?.trim();

  if (configured) {
    const withoutProtocol = configured.replace(/^file:/, "");
    return path.isAbsolute(withoutProtocol)
      ? withoutProtocol
      : path.join(/* turbopackIgnore: true */ process.cwd(), withoutProtocol);
  }

  const dataDirectory = process.env.DIGEST_DATA_DIR?.trim();
  if (dataDirectory) {
    return path.join(
      path.resolve(/* turbopackIgnore: true */ process.cwd(), dataDirectory),
      "digest.db",
    );
  }

  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "data",
    "digest.db",
  );
}

const databasePath = resolveDatabasePath();
const databaseDirectory = path.dirname(databasePath);
fs.mkdirSync(databaseDirectory, { recursive: true, mode: 0o700 });

// Reuse the connection across Next.js dev-server hot reloads so we don't
// accumulate open SQLite handles.
const globalForDb = globalThis as unknown as {
  __dailyDigestSqlite?: Database.Database;
};

const sqlite = globalForDb.__dailyDigestSqlite ?? new Database(databasePath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("synchronous = NORMAL");

// The database contains the user's API key, so keep it readable only by the
// account that owns the desktop app. Best-effort on filesystems without POSIX
// permissions (Windows, some network mounts).
try {
  fs.chmodSync(databasePath, 0o600);
} catch {
  // Ignore: not supported on this platform.
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dailyDigestSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite, databasePath };
export type DatabaseClient = BetterSQLite3Database<typeof schema>;
