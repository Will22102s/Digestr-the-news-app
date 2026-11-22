import type { NextRequest } from "next/server";
import { count, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { briefings } from "@/db/schema";
import { normalizeCategoryFilter } from "@/lib/categories";
import { AppError } from "@/lib/errors";
import { errorResponse, ok, readInteger } from "@/lib/http";

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

    const conditions: SQL[] = [];
    if (category !== "ALL") {
      conditions.push(eq(briefings.categorySlug, category));
    }

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    const rows = await db
      .select()
      .from(briefings)
      .where(whereClause)
      .orderBy(desc(briefings.createdAt), desc(briefings.id))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ value: count() })
      .from(briefings)
      .where(whereClause);

    return ok({
      briefings: rows,
      total: Number(totalRow?.value ?? 0),
      limit,
      offset,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
