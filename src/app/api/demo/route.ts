import type { NextRequest } from "next/server";
import {
  clearDemoData,
  getDemoStatus,
  resetDemoData,
  seedDemoData,
} from "@/db/demo-data";
import { AppError } from "@/lib/errors";
import { errorResponse, ok, readJsonObject, readString } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ demo: getDemoStatus() });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Manage the bundled sample library. `reset` replaces the samples with a fresh
 * copy; `clear` removes them; `load` adds them when they are missing. Live
 * stories and sources are never touched.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);
    const action =
      readString(body.action, {
        field: "action",
        maxLength: 16,
      })?.toLowerCase() ?? "reset";

    if (!["reset", "load", "clear"].includes(action)) {
      throw new AppError(
        400,
        "action must be reset, load, or clear.",
        "INVALID_INPUT",
      );
    }

    const demo =
      action === "clear"
        ? clearDemoData()
        : action === "load"
          ? seedDemoData()
          : resetDemoData();

    return ok({ demo });
  } catch (error) {
    return errorResponse(error);
  }
}
