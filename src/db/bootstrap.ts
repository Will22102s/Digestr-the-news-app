import path from "node:path";
import { count } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { CATEGORY_DEFINITIONS } from "../lib/categories";
import { db, databasePath } from "./index";
import { categories, feeds } from "./schema";
import { SEED_FEEDS } from "./starter-feeds";

export type BootstrapReport = {
  databasePath: string;
  categories: number;
  seededFeeds: number;
  totalFeeds: number;
  skippedSeed: boolean;
};

/**
 * Apply committed migrations and (on a fresh install) add the curated starter
 * feeds. Safe to call on every server start: migrations are journaled and the
 * seed insert uses `ON CONFLICT DO NOTHING`.
 */
export async function bootstrapDatabase(
  options: { forceSeed?: boolean } = {},
): Promise<BootstrapReport> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  migrate(db, { migrationsFolder });

  for (const definition of CATEGORY_DEFINITIONS) {
    db.insert(categories)
      .values({
        name: definition.name,
        slug: definition.slug,
        color: definition.color,
      })
      .onConflictDoNothing({ target: categories.slug })
      .run();
  }

  const categoryRows = db.select().from(categories).all();
  const existingFeedCount = Number(
    db.select({ value: count() }).from(feeds).get()?.value ?? 0,
  );

  if (existingFeedCount > 0 && !options.forceSeed) {
    return {
      databasePath,
      categories: categoryRows.length,
      seededFeeds: 0,
      totalFeeds: existingFeedCount,
      skippedSeed: true,
    };
  }

  const categoryIdBySlug = new Map(
    categoryRows.map((category) => [category.slug, category.id]),
  );

  const feedRows = SEED_FEEDS.map((feed) => {
    const categoryId = categoryIdBySlug.get(feed.category);

    if (!categoryId) {
      throw new Error(`Missing category "${feed.category}" while seeding feeds.`);
    }

    return {
      categoryId,
      name: feed.name,
      url: feed.url,
      sourceType: feed.sourceType,
      isActive: true,
    };
  });

  const inserted = db
    .insert(feeds)
    .values(feedRows)
    .onConflictDoNothing({ target: feeds.url })
    .returning({ id: feeds.id })
    .all();

  const totalFeeds = Number(
    db.select({ value: count() }).from(feeds).get()?.value ?? 0,
  );

  return {
    databasePath,
    categories: categoryRows.length,
    seededFeeds: inserted.length,
    totalFeeds,
    skippedSeed: false,
  };
}
