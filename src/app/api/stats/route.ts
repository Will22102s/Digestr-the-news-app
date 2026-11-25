import { errorResponse, ok } from "@/lib/http";
import { getDigestStats } from "@/lib/server-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight counters for the sidebar after syncs and source edits. */
export async function GET() {
  try {
    return ok(await getDigestStats());
  } catch (error) {
    return errorResponse(error);
  }
}
