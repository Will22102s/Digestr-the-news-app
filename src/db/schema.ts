import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * Editorial categories. Slugs are the stable public identifiers used by the
 * UI (`ALL` is a virtual filter and is never stored here).
 */
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#0A84FF"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * RSS / Atom sources. `sourceType` lets the reader render community and
 * advisory feeds with a different badge than standard news feeds.
 */
export const feeds = sqliteTable(
  "feeds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull().unique(),
    sourceType: text("source_type", {
      enum: ["rss", "community", "advisory"],
    })
      .notNull()
      .default("rss"),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    lastFetchedAt: integer("last_fetched_at", { mode: "timestamp" }),
  },
  (table) => [
    index("feeds_category_id_idx").on(table.categoryId),
    index("feeds_is_active_idx").on(table.isActive),
  ],
);

/**
 * Normalized articles. `url` is globally unique — it is the primary
 * deduplication key across all feeds (including cross-posted stories).
 */
export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    feedId: integer("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    snippet: text("snippet").notNull().default(""),
    publishedAt: integer("published_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    isBookmarked: integer("is_bookmarked", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("articles_published_at_idx").on(table.publishedAt),
    index("articles_category_id_idx").on(table.categoryId),
    index("articles_feed_id_idx").on(table.feedId),
    index("articles_is_bookmarked_idx").on(table.isBookmarked),
  ],
);

/**
 * AI-generated editorial briefings ("Your Daily Read"). Markdown content
 * includes inline citations in the form [Source](https://…).
 */
export const briefings = sqliteTable(
  "briefings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categorySlug: text("category_slug").notNull(),
    title: text("title").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    readTimeMinutes: integer("read_time_minutes").notNull().default(0),
    articleCount: integer("article_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("briefings_category_created_idx").on(
      table.categorySlug,
      table.createdAt,
    ),
  ],
);

/**
 * Small key/value store for local preferences that must survive restarts,
 * such as the user's Gemini API key. Secrets are never sent back to the
 * browser in plain text.
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// Relations (used by Drizzle's relational queries in the API layer)
// ---------------------------------------------------------------------------

export const categoriesRelations = relations(categories, ({ many }) => ({
  feeds: many(feeds),
  articles: many(articles),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  category: one(categories, {
    fields: [feeds.categoryId],
    references: [categories.id],
  }),
  articles: many(articles),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  feed: one(feeds, {
    fields: [articles.feedId],
    references: [feeds.id],
  }),
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Briefing = typeof briefings.$inferSelect;
export type NewBriefing = typeof briefings.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type SourceType = Feed["sourceType"];
