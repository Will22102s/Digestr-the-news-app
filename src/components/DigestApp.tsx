"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Menu,
  Newspaper,
  RefreshCw,
  X,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  generateBriefing,
  getArticles,
  getStats,
  setArticleBookmark,
  syncFeeds,
} from "@/lib/client-api";
import { cn } from "@/lib/cn";
import type { CategoryFilter } from "@/lib/categories";
import type {
  ArticleDTO,
  BriefingDTO,
  StatsDTO,
  ViewMode,
} from "@/lib/types";
import { FeedPanel } from "./FeedPanel";
import { ManageSourcesModal } from "./ManageSourcesModal";
import { ReaderPanel } from "./ReaderPanel";
import { Sidebar } from "./Sidebar";

export type InitialDigestData = {
  view: ViewMode;
  articles: ArticleDTO[];
  articleTotal: number;
  briefings: BriefingDTO[];
  stats: StatsDTO;
};

type DigestAppProps = {
  initial: InitialDigestData;
};

type ToastState = {
  message: string;
  tone: "success" | "error";
};

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function DigestApp({ initial }: DigestAppProps) {
  const [view, setView] = useState<ViewMode>(initial.view);
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 280);

  const [articles, setArticles] = useState<ArticleDTO[]>(initial.articles);
  const [articleTotal, setArticleTotal] = useState(initial.articleTotal);
  const [hasMore, setHasMore] = useState(
    initial.articleTotal > initial.articles.length,
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [briefings, setBriefings] = useState<BriefingDTO[]>(initial.briefings);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(
    initial.articles[0]?.id ?? null,
  );
  const [selectedBriefingId, setSelectedBriefingId] = useState<number | null>(
    initial.briefings[0]?.id ?? null,
  );

  const [stats, setStats] = useState<StatsDTO>(initial.stats);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"list" | "reader">("list");
  const [toast, setToast] = useState<ToastState | null>(null);

  const firstRun = useRef(true);

  const showToast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setToast({ message, tone });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (view === "read") return;

    const key = `${view}|${category}|${debouncedSearch}`;
    if (firstRun.current) {
      firstRun.current = false;
      const isInitialQuery =
        key === `${initial.view}|ALL|` &&
        refreshKey === 0 &&
        initial.articles.length > 0;

      if (isInitialQuery) return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getArticles(
      {
        category,
        q: debouncedSearch,
        bookmarked: view === "bookmarks",
        limit: 60,
      },
      controller.signal,
    )
      .then((response) => {
        setArticles(response.articles);
        setArticleTotal(response.total);
        setHasMore(response.hasMore);
        setSelectedArticleId((previous) =>
          response.articles.some((article) => article.id === previous)
            ? previous
            : (response.articles[0]?.id ?? null),
        );
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(messageFrom(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [
    view,
    category,
    debouncedSearch,
    refreshKey,
    initial.view,
    initial.articles.length,
  ]);

  const visibleBriefings = useMemo(
    () =>
      category === "ALL"
        ? briefings
        : briefings.filter(
            (briefing) => briefing.categorySlug === category,
          ),
    [briefings, category],
  );

  const selectedBriefing = useMemo(
    () =>
      visibleBriefings.find(
        (briefing) => briefing.id === selectedBriefingId,
      ) ??
      visibleBriefings[0] ??
      null,
    [visibleBriefings, selectedBriefingId],
  );

  const selectedArticle = useMemo(
    () =>
      articles.find((article) => article.id === selectedArticleId) ?? null,
    [articles, selectedArticleId],
  );

  const changeView = useCallback(
    (next: ViewMode) => {
      setView(next);
      setSearch("");
      setGenerationError(null);
      setMobilePanel("list");
      setDrawerOpen(false);

      if (next === "read") {
        const pool =
          category === "ALL"
            ? briefings
            : briefings.filter(
                (briefing) => briefing.categorySlug === category,
              );
        setSelectedBriefingId(pool[0]?.id ?? null);
      }
    },
    [briefings, category],
  );

  const changeCategory = useCallback(
    (next: CategoryFilter) => {
      setCategory(next);
      setDrawerOpen(false);

      if (view === "read") {
        const pool =
          next === "ALL"
            ? briefings
            : briefings.filter(
                (briefing) => briefing.categorySlug === next,
              );
        setSelectedBriefingId(pool[0]?.id ?? null);
        setMobilePanel("list");
      } else {
        setMobilePanel("list");
      }
    },
    [briefings, view],
  );

  const handleSelectArticle = useCallback((article: ArticleDTO) => {
    setSelectedArticleId(article.id);
    setMobilePanel("reader");
  }, []);

  const handleSelectBriefing = useCallback((briefing: BriefingDTO) => {
    setSelectedBriefingId(briefing.id);
    setMobilePanel("reader");
  }, []);

  const handleToggleBookmark = useCallback(
    async (article: ArticleDTO) => {
      const nextValue = !article.isBookmarked;

      const applyValue = (value: boolean) => {
        setArticles((previous) =>
          previous.map((item) =>
            item.id === article.id
              ? { ...item, isBookmarked: value }
              : item,
          ),
        );
      };

      applyValue(nextValue);

      try {
        await setArticleBookmark(article.id, nextValue);

        setStats((previous) => ({
          ...previous,
          bookmarks: Math.max(
            0,
            previous.bookmarks + (nextValue ? 1 : -1),
          ),
        }));

        if (view === "bookmarks" && !nextValue) {
          setArticles((previous) =>
            previous.filter((item) => item.id !== article.id),
          );
          setArticleTotal((previous) => Math.max(0, previous - 1));
          setSelectedArticleId((previous) =>
            previous === article.id ? null : previous,
          );
        }
      } catch (cause) {
        applyValue(article.isBookmarked);
        showToast(messageFrom(cause), "error");
      }
    },
    [showToast, view],
  );

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const response = await getArticles({
        category,
        q: debouncedSearch,
        bookmarked: view === "bookmarks",
        limit: 60,
        offset: articles.length,
      });

      setArticles((previous) => {
        const seen = new Set(previous.map((article) => article.id));
        return [
          ...previous,
          ...response.articles.filter((article) => !seen.has(article.id)),
        ];
      });
      setArticleTotal(response.total);
      setHasMore(response.hasMore);
    } catch (cause) {
      showToast(messageFrom(cause), "error");
    } finally {
      setLoadingMore(false);
    }
  }, [
    articles.length,
    category,
    debouncedSearch,
    hasMore,
    loadingMore,
    showToast,
    view,
  ]);

  const handleGenerate = useCallback(async () => {
    if (generating) return;

    setView("read");
    setGenerating(true);
    setGenerationError(null);
    setMobilePanel("reader");

    try {
      const response = await generateBriefing(category);
      setBriefings((previous) => [response.briefing, ...previous]);
      setSelectedBriefingId(response.briefing.id);
      setStats((previous) => ({
        ...previous,
        briefings: previous.briefings + 1,
      }));
      showToast("Your daily read is ready.");
    } catch (cause) {
      const message = messageFrom(cause);
      setGenerationError(message);
      showToast(message, "error");
    } finally {
      setGenerating(false);
    }
  }, [category, generating, showToast]);

  const handleSync = useCallback(async () => {
    if (syncing) return;

    setSyncing(true);
    try {
      const report = await syncFeeds();
      const freshStats = await getStats();

      setStats(freshStats);
      setRefreshKey((previous) => previous + 1);

      const newStories =
        report.articlesInserted === 1
          ? "1 new story"
          : `${report.articlesInserted} new stories`;

      if (report.feedsFailed > 0) {
        showToast(
          `Added ${newStories}; ${report.feedsFailed} feed${
            report.feedsFailed === 1 ? "" : "s"
          } failed.`,
          "error",
        );
      } else if (report.articlesInserted === 0) {
        showToast("You're up to date — no new stories.");
      } else {
        showToast(
          `Added ${newStories} from ${report.feedsSucceeded} sources.`,
        );
      }
    } catch (cause) {
      showToast(messageFrom(cause), "error");
    } finally {
      setSyncing(false);
    }
  }, [showToast, syncing]);

  const handleSourcesChanged = useCallback(async () => {
    try {
      setStats(await getStats());
    } catch {
      // Sidebar counters are cosmetic; the modal surfaces its own errors.
    }
    setRefreshKey((previous) => previous + 1);
  }, []);

  const sidebar = (className?: string) => (
    <Sidebar
      view={view}
      onViewChange={changeView}
      category={category}
      onCategoryChange={changeCategory}
      counts={{
        all: stats.articles.all,
        ai: stats.articles.ai,
        cybersec: stats.articles.cybersec,
        bookmarks: stats.bookmarks,
        briefings: stats.briefings,
        sources: stats.sources.total,
      }}
      lastSyncedAt={stats.lastSyncedAt}
      syncing={syncing}
      onSync={() => void handleSync()}
      onOpenSources={() => {
        setSourcesOpen(true);
        setDrawerOpen(false);
      }}
      onClose={() => setDrawerOpen(false)}
      className={className}
    />
  );

  return (
    <div className="relative h-dvh overflow-hidden bg-obsidian text-ink">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-56 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-[150px]" />
        <div className="absolute -bottom-64 right-[-12%] h-[460px] w-[680px] rounded-full bg-cybersec/[0.035] blur-[160px]" />
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-2 p-2 sm:p-3">
        <div className="flex items-center gap-2 px-1 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="grid size-8 place-items-center rounded-lg border border-hairline bg-white/[0.03] text-ink-secondary transition hover:bg-white/[0.06] hover:text-ink"
          >
            <Menu className="size-4" strokeWidth={2} />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg border border-white/10 bg-white/[0.06]">
              <Newspaper className="size-3.5 text-ink" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold tracking-[-0.02em]">
                The Daily Digest
              </p>
              <p className="truncate text-[9.5px] text-ink-tertiary">
                {stats.articles.all} stories · {stats.sources.active} sources
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            aria-label="Sync feeds"
            className="ml-auto grid size-8 place-items-center rounded-lg border border-hairline bg-white/[0.03] text-ink-secondary transition hover:bg-white/[0.06] hover:text-ink disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-3.5", syncing && "animate-spin")}
              strokeWidth={2}
            />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-[252px_minmax(320px,400px)_minmax(0,1fr)]">
          {sidebar("hidden lg:flex")}

          <FeedPanel
            view={view}
            category={category}
            articles={articles}
            briefings={visibleBriefings}
            total={articleTotal}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            error={error}
            search={search}
            onSearchChange={setSearch}
            selectedArticleId={selectedArticleId}
            selectedBriefingId={selectedBriefing?.id ?? null}
            onSelectArticle={handleSelectArticle}
            onSelectBriefing={handleSelectBriefing}
            onToggleBookmark={(article) => void handleToggleBookmark(article)}
            onLoadMore={() => void handleLoadMore()}
            onGenerate={() => void handleGenerate()}
            onSync={() => void handleSync()}
            onRetry={() => setRefreshKey((previous) => previous + 1)}
            generating={generating}
            syncing={syncing}
            className={cn(mobilePanel === "reader" && "hidden lg:flex")}
          />

          <ReaderPanel
            view={view}
            article={selectedArticle}
            briefing={selectedBriefing}
            generating={generating}
            generationError={generationError}
            onToggleBookmark={(article) => void handleToggleBookmark(article)}
            onGenerate={() => void handleGenerate()}
            onBack={() => setMobilePanel("list")}
            onOpenFeed={() => changeView("feed")}
            className={cn(mobilePanel === "list" && "hidden lg:flex")}
          />
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 w-[282px] max-w-[86vw] animate-slide-in p-2">
            {sidebar("h-full")}
          </div>
        </div>
      ) : null}

      <ManageSourcesModal
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        onChanged={handleSourcesChanged}
        onToast={showToast}
      />

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
          <div
            role="status"
            className={cn(
              "pointer-events-auto flex max-w-[460px] items-center gap-2 rounded-full border px-3.5 py-2 text-[11.5px] font-medium shadow-popover backdrop-blur-xl",
              toast.tone === "error"
                ? "border-cybersec/25 bg-[#2a1517]/92 text-[#ffb3ad]"
                : "border-white/10 bg-[#1c1d21]/92 text-ink",
            )}
          >
            {toast.tone === "error" ? (
              <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.2} />
            ) : (
              <Check className="size-3.5 shrink-0 text-positive" strokeWidth={2.6} />
            )}
            <span className="min-w-0">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="ml-1 grid size-5 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.08]"
            >
              <X className="size-3" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
