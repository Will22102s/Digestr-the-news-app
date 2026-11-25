import { and, count, desc, eq, like, max, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { articles, briefings, categories, feeds } from "@/db/schema";
import type { CategoryFilter } from "./categories";
import type { ArticleDTO, BriefingDTO, StatsDTO } from "./types";

const articleSelection = {
  id: articles.id,
  title: articles.title,
  url: articles.url,
  snippet: articles.snippet,
  publishedAt: articles.publishedAt,
  isBookmarked: articles.isBookmarked,
  feedId: feeds.id,
  feedName: feeds.name,
  sourceType: feeds.sourceType,
  categorySlug: categories.slug,
  categoryName: categories.name,
  categoryColor: categories.color,
};

export type ListArticlesOptions = {
  category?: CategoryFilter;
  bookmarked?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

function articleConditions(options: ListArticlesOptions): SQL[] {
  const conditions: SQL[] = [];

  if (options.category && options.category !== "ALL") {
    conditions.push(eq(categories.slug, options.category));
  }
  if (options.bookmarked !== undefined) {
    conditions.push(eq(articles.isBookmarked, options.bookmarked));
  }
  if (options.search) {
    const term = `%${options.search}%`;
    const clause = or(
      like(articles.title, term),
      like(articles.snippet, term),
    );
    if (clause) conditions.push(clause);
  }

  return conditions;
}

/**
 * Shared article query used by both the page (server render) and the JSON API
 * so the first paint and subsequent fetches are always identical.
 */
export async function listArticles(
  options: ListArticlesOptions = {},
): Promise<{ articles: ArticleDTO[]; total: number }> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 60));
  const offset = Math.max(0, options.offset ?? 0);
  const conditions = articleConditions(options);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select(articleSelection)
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

  return {
    articles: rows.map((row) => ({
      ...row,
      publishedAt: row.publishedAt.toISOString(),
    })),
    total: Number(totalRow?.value ?? 0),
  };
}

export async function listBriefings(
  options: {
    category?: CategoryFilter;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ briefings: BriefingDTO[]; total: number }> {
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const offset = Math.max(0, options.offset ?? 0);

  const whereClause =
    options.category && options.category !== "ALL"
      ? eq(briefings.categorySlug, options.category)
      : undefined;

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

  return {
    briefings: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    total: Number(totalRow?.value ?? 0),
  };
}

export async function getDigestStats(): Promise<StatsDTO> {
  const [
    byCategory,
    bookmarkRow,
    briefingRow,
    sourceRow,
    activeRow,
    syncRow,
  ] = await Promise.all([
    db
      .select({ slug: categories.slug, value: count() })
      .from(articles)
      .innerJoin(categories, eq(articles.categoryId, categories.id))
      .groupBy(categories.slug),
    db
      .select({ value: count() })
      .from(articles)
      .where(eq(articles.isBookmarked, true)),
    db.select({ value: count() }).from(briefings),
    db.select({ value: count() }).from(feeds),
    db
      .select({ value: count() })
      .from(feeds)
      .where(eq(feeds.isActive, true)),
    db.select({ value: max(feeds.lastFetchedAt) }).from(feeds),
  ]);

  const counts = new Map(
    byCategory.map((row) => [row.slug, Number(row.value)]),
  );
  const ai = counts.get("AI") ?? 0;
  const cybersec = counts.get("CYBERSEC") ?? 0;
  const lastSyncedAt = syncRow[0]?.value;

  return {
    articles: { all: ai + cybersec, ai, cybersec },
    bookmarks: Number(bookmarkRow[0]?.value ?? 0),
    briefings: Number(briefingRow[0]?.value ?? 0),
    sources: {
      total: Number(sourceRow[0]?.value ?? 0),
      active: Number(activeRow[0]?.value ?? 0),
    },
    lastSyncedAt: lastSyncedAt
      ? new Date(lastSyncedAt).toISOString()
      : null,
  };
}
