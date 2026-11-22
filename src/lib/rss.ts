import pLimit from "p-limit";
import Parser from "rss-parser";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, feeds } from "@/db/schema";
import { AppError } from "./errors";
import { buildSnippet, cleanText, truncateAtWord } from "./text";
import { canonicalizeArticleUrl, feedHostname } from "./url";
import type { CategoryFilter } from "./categories";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0 Safari/537.36 TheDailyDigest/1.0 (+RSS reader)";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FEED_BYTES = 8 * 1024 * 1024;
const MAX_ITEMS_PER_FEED = 60;
const DEFAULT_CONCURRENCY = 8;

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  date?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
};

type ParsedFeed = {
  title?: string;
  items: FeedItem[];
};

type FeedRow = {
  id: number;
  name: string;
  url: string;
  categoryId: number;
};

export type SyncFeedError = {
  feedId: number;
  name: string;
  url: string;
  message: string;
};

export type SyncReport = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  feedsAttempted: number;
  feedsSucceeded: number;
  feedsFailed: number;
  articlesFound: number;
  articlesInserted: number;
  duplicatesSkipped: number;
  errors: SyncFeedError[];
};

export type SyncOptions = {
  categorySlug?: CategoryFilter;
  feedId?: number;
  limit?: number;
  concurrency?: number;
};

const parser = new Parser<Record<string, unknown>, FeedItem>({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": USER_AGENT,
    Accept:
      "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
});

function parsePublishedAt(value: string | undefined): Date {
  if (!value) return new Date();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();

  const now = Date.now();
  const timestamp = parsed.getTime();

  // Placeholder dates (1970, etc.) and future timestamps break chronological
  // ordering, so fall back to ingestion time.
  if (timestamp < Date.UTC(2000, 0, 1) || timestamp > now + 24 * 60 * 60_000) {
    return new Date();
  }

  return parsed;
}

async function fetchFeedDocument(url: string): Promise<ParsedFeed> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Feed returned HTTP ${response.status}.`);
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FEED_BYTES) {
    throw new Error("Feed is larger than the 8 MB safety limit.");
  }

  const xml = await response.text();
  if (Buffer.byteLength(xml, "utf8") > MAX_FEED_BYTES) {
    throw new Error("Feed is larger than the 8 MB safety limit.");
  }
  if (!xml.trim()) {
    throw new Error("Feed returned an empty response.");
  }

  const parsed = await parser.parseString(xml.replace(/^\uFEFF/, ""));
  return {
    title: cleanText(parsed.title),
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

function normalizeItems(rawItems: FeedItem[], feedUrl: string) {
  const seen = new Set<string>();
  const normalized: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedAt: Date;
  }> = [];

  for (const item of rawItems.slice(0, MAX_ITEMS_PER_FEED)) {
    const title = cleanText(item.title);
    const link = canonicalizeArticleUrl(
      item.link ?? item.guid ?? "",
      feedUrl,
    );

    if (!title || !link || seen.has(link)) continue;
    seen.add(link);

    normalized.push({
      title: truncateAtWord(title, 240),
      url: link,
      snippet: buildSnippet(item),
      publishedAt: parsePublishedAt(item.isoDate ?? item.pubDate ?? item.date),
    });
  }

  return normalized;
}

/** Read a feed without persisting anything. Used when adding a new source. */
export async function inspectFeed(url: string): Promise<{
  title: string;
  itemCount: number;
}> {
  const parsed = await fetchFeedDocument(url);
  return {
    title: parsed.title || feedHostname(url),
    itemCount: parsed.items.length,
  };
}

async function syncOneFeed(feed: FeedRow): Promise<{
  found: number;
  inserted: number;
  skipped: number;
}> {
  const parsed = await fetchFeedDocument(feed.url);
  const items = normalizeItems(parsed.items, feed.url);

  if (items.length === 0) {
    await db
      .update(feeds)
      .set({ lastFetchedAt: new Date() })
      .where(eq(feeds.id, feed.id));
    return { found: 0, inserted: 0, skipped: 0 };
  }

  const insertedRows = await db
    .insert(articles)
    .values(
      items.map((item) => ({
        feedId: feed.id,
        categoryId: feed.categoryId,
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        publishedAt: item.publishedAt,
        isBookmarked: false,
      })),
    )
    .onConflictDoNothing({ target: articles.url })
    .returning({ id: articles.id });

  await db
    .update(feeds)
    .set({ lastFetchedAt: new Date() })
    .where(eq(feeds.id, feed.id));

  return {
    found: items.length,
    inserted: insertedRows.length,
    skipped: items.length - insertedRows.length,
  };
}

function readConcurrency(value: number | undefined): number {
  if (value !== undefined) {
    return Math.min(50, Math.max(1, Math.trunc(value)));
  }

  const configured = Number.parseInt(process.env.SYNC_CONCURRENCY ?? "", 10);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(50, configured);
  }

  return DEFAULT_CONCURRENCY;
}

/**
 * Fetch every active source with bounded concurrency. One failing feed never
 * aborts the run; failures are returned in the report.
 */
export async function syncAllFeeds(
  options: SyncOptions = {},
): Promise<SyncReport> {
  const startedAt = new Date();

  const conditions = [eq(feeds.isActive, true)];

  if (options.categorySlug && options.categorySlug !== "ALL") {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, options.categorySlug))
      .limit(1);

    if (!category) {
      throw new AppError(404, "Category not found.", "CATEGORY_NOT_FOUND");
    }
    conditions.push(eq(feeds.categoryId, category.id));
  }

  if (options.feedId !== undefined) {
    conditions.push(eq(feeds.id, options.feedId));
  }

  const rowLimit = Math.min(5_000, Math.max(1, options.limit ?? 5_000));
  const selectedFeeds = await db
    .select({
      id: feeds.id,
      name: feeds.name,
      url: feeds.url,
      categoryId: feeds.categoryId,
    })
    .from(feeds)
    .where(and(...conditions))
    .orderBy(feeds.id)
    .limit(rowLimit);

  const concurrency = readConcurrency(options.concurrency);
  const limitConcurrency = pLimit(concurrency);

  let feedsSucceeded = 0;
  let feedsFailed = 0;
  let articlesFound = 0;
  let articlesInserted = 0;
  let duplicatesSkipped = 0;

  const errors: SyncFeedError[] = [];

  await Promise.all(
    selectedFeeds.map((feed) =>
      limitConcurrency(async () => {
        try {
          const result = await syncOneFeed(feed);
          feedsSucceeded += 1;
          articlesFound += result.found;
          articlesInserted += result.inserted;
          duplicatesSkipped += result.skipped;
        } catch (error) {
          feedsFailed += 1;
          errors.push({
            feedId: feed.id,
            name: feed.name,
            url: feed.url,
            message: truncateAtWord(
              error instanceof Error ? error.message : "Unknown feed error.",
              240,
            ),
          });
        }
      }),
    ),
  );

  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    feedsAttempted: selectedFeeds.length,
    feedsSucceeded,
    feedsFailed,
    articlesFound,
    articlesInserted,
    duplicatesSkipped,
    errors: errors.slice(0, 50),
  };
}
