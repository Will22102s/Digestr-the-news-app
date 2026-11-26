import type { CategoryFilter } from "./categories";

export type ViewMode = "read" | "feed" | "bookmarks";

export type SourceType = "rss" | "community" | "advisory";

export type ArticleDTO = {
  id: number;
  title: string;
  url: string;
  snippet: string;
  publishedAt: string;
  isBookmarked: boolean;
  feedId: number;
  feedName: string;
  sourceType: SourceType;
  categorySlug: string;
  categoryName: string;
  categoryColor: string;
};

export type BriefingDTO = {
  id: number;
  categorySlug: string;
  title: string;
  contentMarkdown: string;
  readTimeMinutes: number;
  articleCount: number;
  createdAt: string;
};

export type SourceDTO = {
  id: number;
  categoryId: number;
  name: string;
  url: string;
  sourceType: SourceType;
  isActive: boolean;
  lastFetchedAt: string | null;
  categorySlug: string;
  categoryName: string;
  categoryColor: string;
  articleCount: number;
};

export type ArticlesResponse = {
  articles: ArticleDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type BriefingsResponse = {
  briefings: BriefingDTO[];
  total: number;
  limit: number;
  offset: number;
};

export type SourcesResponse = {
  sources: SourceDTO[];
  total: number;
};

export type GenerateBriefingResponse = {
  briefing: BriefingDTO;
  sources: Array<{
    id: number;
    title: string;
    url: string;
    sourceName: string;
    publishedAt: string;
  }>;
};

export type StatsDTO = {
  articles: { all: number; ai: number; cybersec: number };
  bookmarks: number;
  briefings: number;
  sources: { total: number; active: number };
  lastSyncedAt: string | null;
};

export type CredentialSource = "database" | "environment" | null;

export type SettingsDTO = {
  gemini: {
    configured: boolean;
    maskedKey: string | null;
    source: CredentialSource;
    model: string;
    modelSource: "database" | "environment" | "default";
  };
};

export type SettingsTestResponse = {
  ok: true;
  model: string;
  reply: string;
  maskedKey: string;
  source: "database" | "environment" | "candidate";
};

export type SyncReport = {
  feedsAttempted: number;
  feedsSucceeded: number;
  feedsFailed: number;
  articlesFound: number;
  articlesInserted: number;
  duplicatesSkipped: number;
  durationMs: number;
  errors: Array<{
    feedId: number;
    name: string;
    message: string;
  }>;
};

export type CategorySelection = CategoryFilter;
