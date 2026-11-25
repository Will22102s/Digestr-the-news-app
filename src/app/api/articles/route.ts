import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { normalizeCategoryFilter } from "@/lib/categories";
import { AppError } from "@/lib/errors";
import {
  errorResponse,
  ok,
  readBoolean,
  readInteger,
  readJsonObject,
  readString,
} from "@/lib/http";
import { listArticles } from "@/lib/server-queries";

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

    const bookmarked = readBoolean(params.get("bookmarked"), "bookmarked");
    const search = readString(params.get("q"), {
      field: "q",
      maxLength: 200,
    });
    const limit = readInteger(params.get("limit"), 40, {
      min: 1,
      max: 100,
      field: "limit",
    });
    const offset = readInteger(params.get("offset"), 0, {
      min: 0,
      max: 1_000_000,
      field: "offset",
    });

    const { articles: rows, total } = await listArticles({
      category,
      bookmarked,
      search,
      limit,
      offset,
    });

    return ok({
      articles: rows,
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Toggle or set a bookmark. PATCH keeps the endpoint REST-ish without a
 * separate dynamic segment, which makes bulk UI updates simpler. */
export async function PATCH(request: NextRequest) {
  try {
    const body = await readJsonObject(request);

    if (body.id === undefined) {
      throw new AppError(400, "id is required.", "INVALID_INPUT");
    }

    const id = readInteger(body.id, 0, {
      min: 1,
      max: 2_147_483_647,
      field: "id",
    });

    const [existing] = await db
      .select({ id: articles.id, isBookmarked: articles.isBookmarked })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    if (!existing) {
      throw new AppError(404, "Article not found.", "ARTICLE_NOT_FOUND");
    }

    const requested = readBoolean(body.isBookmarked, "isBookmarked");
    const nextValue =
      requested === undefined ? !existing.isBookmarked : requested;

    const [updated] = await db
      .update(articles)
      .set({ isBookmarked: nextValue })
      .where(eq(articles.id, id))
      .returning();

    return ok({ article: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
