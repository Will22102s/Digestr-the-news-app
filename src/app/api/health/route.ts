import { sqlite } from "@/db";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe used by the Tauri shell to wait for the
 * sidecar before showing the window.
 */
export function GET() {
  try {
    sqlite.prepare("select 1 as ready").get();
    return ok({ status: "ok", database: "ready" });
  } catch (error) {
    return ok(
      {
        status: "starting",
        database: "unavailable",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      503,
    );
  }
}
