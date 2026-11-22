import type { NextRequest } from "next/server";
import { count, eq } from "drizzle-orm";
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
import { inspectFeed } from "@/lib/rss";
import { truncateAtWord } from "@/lib/text";
import { feedHostname, normalizeFeedUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceType = "rss" | "community" | "advisory";

function parseSourceType(
  value: unknown,
  fallback?: SourceType,
): SourceType | undefined {
  if (value === undefined || value === null || value === "") return fallback;

  const normalized = String(value).toLowerCase();
  if (
    normalized === "rss" ||
    normalized === "community" ||
    normalized === "advisory"
  ) {
    return normalized;
  }

  throw new AppError(
    400,
    "sourceType must be rss, community, or advisory.",
    "INVALID_SOURCE_TYPE",
  );
}

function inferSourceType(url: string): SourceType {
  const normalized = url.toLowerCase();
  if (normalized.includes("hnrss.org") || normalized.includes("ycombinator")) {
    return "community";
  }
  if (normalized.includes("cisa.gov")) return "advisory";
  return "rss";
}

async function resolveCategoryId(rawSlug: unknown): Promise<number> {
  const slug = normalizeCategoryFilter(
    readString(rawSlug, { field: "categorySlug", maxLength: 24 }) ?? "AI",
  );

  if (!slug || slug === "ALL") {
    throw new AppError(
      400,
      "categorySlug must be AI or CYBERSEC.",
      "INVALID_CATEGORY",
    );
  }

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (!category) {
    throw new AppError(404, "Category not found.", "CATEGORY_NOT_FOUND");
  }

  return category.id;
}

export async function GET() {
  try {
    const rows = await db
      .select({
        id: feeds.id,
        categoryId: feeds.categoryId,
        name: feeds.name,
        url: feeds.url,
        sourceType: feeds.sourceType,
        isActive: feeds.isActive,
        lastFetchedAt: feeds.lastFetchedAt,
        categorySlug: categories.slug,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(feeds)
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .orderBy(categories.slug, feeds.name);

    const counts = await db
      .select({ feedId: articles.feedId, value: count() })
      .from(articles)
      .groupBy(articles.feedId);

    const countByFeed = new Map(
      counts.map((row) => [row.feedId, Number(row.value)]),
    );

    return ok({
      sources: rows.map((row) => ({
        ...row,
        articleCount: countByFeed.get(row.id) ?? 0,
      })),
      total: rows.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);

    const rawUrl = readString(body.url, {
      field: "url",
      maxLength: 2_048,
      required: true,
    })!;

    let url: string;
    try {
      url = normalizeFeedUrl(rawUrl);
    } catch (error) {
      throw new AppError(
        400,
        error instanceof Error ? error.message : "Invalid feed URL.",
        "INVALID_FEED_URL",
      );
    }

    const [duplicate] = await db
      .select({ id: feeds.id })
      .from(feeds)
      .where(eq(feeds.url, url))
      .limit(1);

    if (duplicate) {
      throw new AppError(
        409,
        "That feed is already in your sources.",
        "FEED_EXISTS",
      );
    }

    const categoryId = await resolveCategoryId(body.categorySlug);

    let feedTitle = "";
    let itemCount = 0;
    try {
      const inspected = await inspectFeed(url);
      feedTitle = inspected.title;
      itemCount = inspected.itemCount;
    } catch (error) {
      throw new AppError(
        422,
        `Could not read that feed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        "FEED_UNREADABLE",
      );
    }

    const providedName = readString(body.name, {
      field: "name",
      maxLength: 120,
    });
    const name = truncateAtWord(
      providedName || feedTitle || feedHostname(url),
      120,
    );

    const sourceType =
      parseSourceType(body.sourceType) ?? inferSourceType(url);

    const [created] = await db
      .insert(feeds)
      .values({
        categoryId,
        name,
        url,
        sourceType,
        isActive: true,
      })
      .returning();

    return ok(
      {
        source: { ...created, articleCount: 0 },
        previewItems: itemCount,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

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
      .select()
      .from(feeds)
      .where(eq(feeds.id, id))
      .limit(1);

    if (!existing) {
      throw new AppError(404, "Source not found.", "SOURCE_NOT_FOUND");
    }

    const updates: {
      name?: string;
      url?: string;
      categoryId?: number;
      sourceType?: SourceType;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      updates.name = truncateAtWord(
        readString(body.name, {
          field: "name",
          maxLength: 120,
          required: true,
        })!,
        120,
      );
    }

    if (body.url !== undefined) {
      const rawUrl = readString(body.url, {
        field: "url",
        maxLength: 2_048,
        required: true,
      })!;

      let url: string;
      try {
        url = normalizeFeedUrl(rawUrl);
      } catch (error) {
        throw new AppError(
          400,
          error instanceof Error ? error.message : "Invalid feed URL.",
          "INVALID_FEED_URL",
        );
      }

      if (url !== existing.url) {
        const [duplicate] = await db
          .select({ id: feeds.id })
          .from(feeds)
          .where(eq(feeds.url, url))
          .limit(1);

        if (duplicate && duplicate.id !== id) {
          throw new AppError(
            409,
            "Another source already uses that feed URL.",
            "FEED_EXISTS",
          );
        }
      }

      updates.url = url;
    }

    if (body.categorySlug !== undefined) {
      updates.categoryId = await resolveCategoryId(body.categorySlug);
    }

    if (body.sourceType !== undefined) {
      updates.sourceType = parseSourceType(body.sourceType);
    }

    if (body.isActive !== undefined) {
      const active = readBoolean(body.isActive, "isActive");
      if (active !== undefined) updates.isActive = active;
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(
        400,
        "Provide at least one field to update.",
        "NO_UPDATES",
      );
    }

    await db.update(feeds).set(updates).where(eq(feeds.id, id));

    // Keep the denormalized article category in sync when a source moves.
    if (
      updates.categoryId !== undefined &&
      updates.categoryId !== existing.categoryId
    ) {
      await db
        .update(articles)
        .set({ categoryId: updates.categoryId })
        .where(eq(articles.feedId, id));
    }

    const [updated] = await db
      .select({
        id: feeds.id,
        categoryId: feeds.categoryId,
        name: feeds.name,
        url: feeds.url,
        sourceType: feeds.sourceType,
        isActive: feeds.isActive,
        lastFetchedAt: feeds.lastFetchedAt,
        categorySlug: categories.slug,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(feeds)
      .innerJoin(categories, eq(feeds.categoryId, categories.id))
      .where(eq(feeds.id, id))
      .limit(1);

    return ok({ source: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = readInteger(request.nextUrl.searchParams.get("id"), 0, {
      min: 1,
      max: 2_147_483_647,
      field: "id",
    });

    const deleted = await db
      .delete(feeds)
      .where(eq(feeds.id, id))
      .returning({ id: feeds.id });

    if (deleted.length === 0) {
      throw new AppError(404, "Source not found.", "SOURCE_NOT_FOUND");
    }

    return ok({ deleted: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}
