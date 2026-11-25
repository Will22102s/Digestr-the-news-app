"use client";

import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CategoryFilter } from "@/lib/categories";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatRelativeTime } from "@/lib/format";
import type { ArticleDTO, BriefingDTO, ViewMode } from "@/lib/types";

type FeedPanelProps = {
  view: ViewMode;
  category: CategoryFilter;
  articles: ArticleDTO[];
  briefings: BriefingDTO[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  selectedArticleId: number | null;
  selectedBriefingId: number | null;
  onSelectArticle: (article: ArticleDTO) => void;
  onSelectBriefing: (briefing: BriefingDTO) => void;
  onToggleBookmark: (article: ArticleDTO) => void;
  onLoadMore: () => void;
  onGenerate: () => void;
  onSync: () => void;
  onRetry: () => void;
  generating: boolean;
  syncing: boolean;
  className?: string;
};

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-10 place-items-center rounded-xl border border-hairline bg-white/[0.03]">
        <Icon className="size-4 text-ink-tertiary" strokeWidth={1.8} />
      </div>
      <p className="mt-3.5 text-[13px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-[240px] text-[11.5px] leading-relaxed text-ink-tertiary">
        {body}
      </p>
      {action}
    </div>
  );
}

function ArticleCard({
  article,
  selected,
  onSelect,
  onToggleBookmark,
}: {
  article: ArticleDTO;
  selected: boolean;
  onSelect: () => void;
  onToggleBookmark: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl transition-colors",
        selected ? "bg-white/[0.055]" : "hover:bg-white/[0.03]",
      )}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-accent"
        />
      ) : null}

      <button
        type="button"
        onClick={onSelect}
        className="block w-full px-3 py-2.5 pr-10 text-left"
      >
        <div className="flex items-center gap-1.5 text-[10.5px] text-ink-tertiary">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: article.categoryColor }}
          />
          <span className="truncate font-medium text-ink-secondary">
            {article.feedName}
          </span>
          <span aria-hidden>·</span>
          <span className="shrink-0">
            {formatRelativeTime(article.publishedAt)}
          </span>
        </div>

        <h3
          className={cn(
            "mt-1.5 line-clamp-2 text-[13px] font-medium leading-[1.35] tracking-[-0.01em]",
            selected ? "text-white" : "text-ink group-hover:text-white",
          )}
        >
          {article.title}
        </h3>

        {article.snippet ? (
          <p className="mt-1 line-clamp-2 text-[11.5px] leading-[1.45] text-ink-tertiary">
            {article.snippet}
          </p>
        ) : null}
      </button>

      <button
        type="button"
        onClick={onToggleBookmark}
        aria-label={
          article.isBookmarked
            ? `Remove ${article.title} from bookmarks`
            : `Bookmark ${article.title}`
        }
        aria-pressed={article.isBookmarked}
        className={cn(
          "absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg transition",
          article.isBookmarked
            ? "text-accent"
            : "text-ink-tertiary opacity-0 hover:bg-white/[0.06] hover:text-ink group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {article.isBookmarked ? (
          <BookmarkCheck className="size-3.5" strokeWidth={2} />
        ) : (
          <Bookmark className="size-3.5" strokeWidth={1.9} />
        )}
      </button>
    </div>
  );
}

function BriefingCard({
  briefing,
  selected,
  onSelect,
}: {
  briefing: BriefingDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const categoryLabel =
    briefing.categorySlug === "AI"
      ? "AI desk"
      : briefing.categorySlug === "CYBERSEC"
        ? "Security desk"
        : "All desks";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative block w-full rounded-xl px-3 py-3 text-left transition-colors",
        selected ? "bg-white/[0.055]" : "hover:bg-white/[0.03]",
      )}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-accent"
        />
      ) : null}

      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7ab8ff]">
        <Sparkles className="size-3" strokeWidth={2} />
        Daily Read
        <span className="text-ink-tertiary">·</span>
        <span className="font-medium normal-case tracking-normal text-ink-tertiary">
          {categoryLabel}
        </span>
      </div>

      <h3
        className={cn(
          "mt-1.5 line-clamp-2 text-[13px] font-medium leading-[1.4] tracking-[-0.01em]",
          selected ? "text-white" : "text-ink",
        )}
      >
        {briefing.title}
      </h3>

      <p className="mt-1.5 text-[10.5px] text-ink-tertiary">
        {formatRelativeTime(briefing.createdAt)} · {briefing.readTimeMinutes} min
        read · {briefing.articleCount} sources
      </p>
    </button>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-1.5 px-1 pt-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-xl px-3 py-3">
          <div className="skeleton h-2 w-24 rounded-full" />
          <div className="skeleton mt-2.5 h-3 w-full rounded-full" />
          <div className="skeleton mt-1.5 h-3 w-3/5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

const COPY: Record<
  ViewMode,
  { eyebrow: string; title: string; description: string }
> = {
  read: {
    eyebrow: "Synthesis",
    title: "Today's Read",
    description: "One calm, cited briefing from the day's reporting.",
  },
  feed: {
    eyebrow: "Browse",
    title: "Live Feed",
    description: "Fresh headlines from every desk.",
  },
  bookmarks: {
    eyebrow: "Saved",
    title: "Bookmarks",
    description: "Stories you kept for a slower read.",
  },
};

export function FeedPanel({
  view,
  category,
  articles,
  briefings,
  total,
  loading,
  loadingMore,
  hasMore,
  error,
  search,
  onSearchChange,
  selectedArticleId,
  selectedBriefingId,
  onSelectArticle,
  onSelectBriefing,
  onToggleBookmark,
  onLoadMore,
  onGenerate,
  onSync,
  onRetry,
  generating,
  syncing,
  className,
}: FeedPanelProps) {
  const copy = COPY[view];
  const showSearch = view !== "read";
  const itemCount = view === "read" ? briefings.length : total;

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-hairline bg-panel/45 backdrop-blur-xl",
        className,
      )}
      aria-label={copy.title}
    >
      <header className="shrink-0 border-b border-hairline px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
              {copy.eyebrow}
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <h1 className="text-[19px] font-semibold tracking-[-0.03em] text-ink">
                {copy.title}
              </h1>
              <span className="text-[10.5px] tabular-nums text-ink-tertiary">
                {itemCount}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-tertiary">
              {copy.description}
            </p>
          </div>

          {view === "read" ? (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2.5 py-1.5 text-[11px] font-semibold text-[#8cc4ff] transition hover:bg-accent/20 disabled:cursor-progress disabled:opacity-70"
            >
              {generating ? (
                <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />
              ) : (
                <Sparkles className="size-3" strokeWidth={2.5} />
              )}
              {generating ? "Writing" : "Generate"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              aria-label="Sync feeds"
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-hairline bg-white/[0.03] text-ink-secondary transition hover:bg-white/[0.06] hover:text-ink disabled:opacity-60"
            >
              <RefreshCw
                className={cn("size-3.5", syncing && "animate-spin")}
                strokeWidth={2}
              />
            </button>
          )}
        </div>

        {showSearch ? (
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-tertiary"
              strokeWidth={2}
            />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={
                view === "bookmarks"
                  ? "Search saved stories…"
                  : "Search headlines…"
              }
              className="h-8 w-full rounded-[9px] border border-hairline bg-white/[0.03] pl-8 pr-8 text-[12px] text-ink outline-none transition placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-md text-ink-tertiary transition hover:bg-white/[0.06] hover:text-ink"
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {error ? (
          <div className="mx-1 mt-1 rounded-xl border border-cybersec/20 bg-cybersec/[0.06] p-3 text-[11.5px] leading-relaxed text-ink-secondary">
            <p className="flex items-center gap-1.5 font-medium text-cybersec">
              <AlertCircle className="size-3.5" strokeWidth={2} />
              Could not load stories
            </p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-ink transition hover:bg-white/[0.1]"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <FeedSkeleton />
        ) : view === "read" ? (
          <>
            {generating ? (
              <div className="mx-1 mb-2 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2.5 text-[11.5px] text-[#8cc4ff]">
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
                Reading today&apos;s reporting…
              </div>
            ) : null}

            {briefings.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No briefing yet"
                body="Generate one calm, cited read from today's best reporting."
                action={
                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={generating}
                    className="mt-3 rounded-lg bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-obsidian transition hover:bg-white disabled:opacity-60"
                  >
                    {generating ? "Writing…" : "Generate your read"}
                  </button>
                }
              />
            ) : (
              <div className="space-y-0.5">
                {briefings.map((briefing) => (
                  <BriefingCard
                    key={briefing.id}
                    briefing={briefing}
                    selected={briefing.id === selectedBriefingId}
                    onSelect={() => onSelectBriefing(briefing)}
                  />
                ))}
              </div>
            )}
          </>
        ) : articles.length === 0 ? (
          search ? (
            <EmptyState
              icon={Search}
              title="No matches"
              body={`Nothing found for “${search}”. Try a different phrase or sync your feeds.`}
            />
          ) : view === "bookmarks" ? (
            <EmptyState
              icon={Bookmark}
              title="Nothing saved yet"
              body="Tap the bookmark icon on any story to keep it here for later."
            />
          ) : (
            <EmptyState
              icon={RefreshCw}
              title="The feed is quiet"
              body="Sync your sources to pull the latest headlines."
              action={
                <button
                  type="button"
                  onClick={onSync}
                  disabled={syncing}
                  className="mt-3 rounded-lg bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-obsidian transition hover:bg-white disabled:opacity-60"
                >
                  {syncing ? "Syncing…" : "Sync feeds"}
                </button>
              }
            />
          )
        ) : (
          <div className="space-y-0.5">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                selected={article.id === selectedArticleId}
                onSelect={() => onSelectArticle(article)}
                onToggleBookmark={() => onToggleBookmark(article)}
              />
            ))}

            {hasMore ? (
              <div className="px-1 pb-1 pt-3">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline bg-white/[0.02] py-2 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.05] hover:text-ink disabled:cursor-progress disabled:opacity-60"
                >
                  {loadingMore ? (
                    <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />
                  ) : null}
                  {loadingMore ? "Loading…" : "Load more stories"}
                </button>
              </div>
            ) : (
              <p className="px-1 pb-1 pt-4 text-center text-[10.5px] text-ink-tertiary">
                End of the feed · {CATEGORY_LABELS[category]}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
