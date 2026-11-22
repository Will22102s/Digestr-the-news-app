import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/** Resolve the SQLite file relative to the project root. */
function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_URL ?? "./data/digest.db";
  const withoutProtocol = configured.replace(/^file:/, "");
  return path.isAbsolute(withoutProtocol)
    ? withoutProtocol
    : path.join(/* turbopackIgnore: true */ process.cwd(), withoutProtocol);
}

const databasePath = resolveDatabasePath();
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

// Reuse the connection across Next.js dev-server hot reloads so we don't
// accumulate open SQLite handles.
const globalForDb = globalThis as unknown as {
  __dailyDigestSqlite?: Database.Database;
};

const sqlite = globalForDb.__dailyDigestSqlite ?? new Database(databasePath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dailyDigestSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite, databasePath };
export type DatabaseClient = BetterSQLite3Database<typeof schema>;
