import type { NextRequest } from "next/server";
import { and, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, feeds } from "@/db/schema";
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

    const conditions: SQL[] = [];

    if (category !== "ALL") {
      conditions.push(eq(categories.slug, category));
    }
    if (bookmarked !== undefined) {
      conditions.push(eq(articles.isBookmarked, bookmarked));
    }
    if (search) {
      const term = `%${search}%`;
      const searchClause = or(
        like(articles.title, term),
        like(articles.snippet, term),
      );
      if (searchClause) conditions.push(searchClause);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        snippet: articles.snippet,
        publishedAt: articles.publishedAt,
        isBookmarked: articles.isBookmarked,
        createdAt: articles.createdAt,
        feedId: feeds.id,
        feedName: feeds.name,
        sourceType: feeds.sourceType,
        categorySlug: categories.slug,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(articles.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(articles.publishedAt), desc(articles.id))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ value: count() })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .innerJoin(categories, eq(articles.categoryId, categories.id))
      .where(whereClause);

    const total = Number(totalRow?.value ?? 0);

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
