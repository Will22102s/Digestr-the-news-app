import type { NextRequest } from "next/server";
import { normalizeCategoryFilter } from "@/lib/categories";
import { AppError } from "@/lib/errors";
import { errorResponse, ok, readInteger } from "@/lib/http";
import { listBriefings } from "@/lib/server-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const category = normalizeCategoryFilter(params.get("category"));

    if (!category) {
      throw new AppError(
        400,
        "category must be ALL, AI, or CYBERSEC.",
        "INVALID_CATEGORY",
      );
    }

    const limit = readInteger(params.get("limit"), 1, {
      min: 1,
      max: 20,
      field: "limit",
    });
    const offset = readInteger(params.get("offset"), 0, {
      min: 0,
      max: 10_000,
      field: "offset",
    });

    const { briefings, total } = await listBriefings({
      category,
      limit,
      offset,
    });

    return ok({ briefings, total, limit, offset });
  } catch (error) {
    return errorResponse(error);
  }
}
