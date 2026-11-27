"use client";

import { useEffect, useRef } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Clock,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatFullDate, formatRelativeTime, hostnameFromUrl, sourceTypeLabel } from "@/lib/format";
import type { ArticleDTO, BriefingDTO, ViewMode } from "@/lib/types";
import { Markdown } from "./Markdown";

type ReaderPanelProps = {
  view: ViewMode;
  article: ArticleDTO | null;
  briefing: BriefingDTO | null;
  generating: boolean;
  generationError: string | null;
  onToggleBookmark: (article: ArticleDTO) => void;
  onGenerate: () => void;
  onBack: () => void;
  onOpenFeed: () => void;
  className?: string;
};

function briefingDesk(slug: string): string {
  if (slug === "AI") return "AI desk";
  if (slug === "CYBERSEC") return "Security desk";
  return "All desks";
}

function providerLabel(provider: string): string {
  if (provider === "gemini") return "Google Gemini";
  if (provider === "groq") return "Groq";
  if (provider === "ollama") return "Ollama";
  if (provider === "demo") return "the Digestr demo desk";
  return "the built-in algorithmic editor";
}

function IconButton({
  label,
  onClick,
  href,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "grid size-8 place-items-center rounded-lg border transition",
    active
      ? "border-accent/30 bg-accent-soft text-accent"
      : "border-hairline bg-white/[0.03] text-ink-secondary hover:bg-white/[0.06] hover:text-ink",
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={label}
        title={label}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={className}
    >
      {children}
    </button>
  );
}

export function ReaderPanel({
  view,
  article,
  briefing,
  generating,
  generationError,
  onToggleBookmark,
  onGenerate,
  onBack,
  onOpenFeed,
  className,
}: ReaderPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [article?.id, briefing?.id, view]);

  const eyebrow =
    view === "read"
      ? "Today's Read"
      : article
        ? article.categoryName
        : "Reader";

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-hairline bg-panel/35 backdrop-blur-xl",
        className,
      )}
      aria-label="Reader"
    >
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-hairline px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to stories"
          className="grid size-8 place-items-center rounded-lg text-ink-secondary transition hover:bg-white/[0.05] hover:text-ink lg:hidden"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
            {eyebrow}
          </p>
        </div>

        {article && view !== "read" ? (
          <div className="flex items-center gap-1.5">
            <IconButton
              label={article.isBookmarked ? "Remove bookmark" : "Bookmark story"}
              onClick={() => onToggleBookmark(article)}
              active={article.isBookmarked}
            >
              {article.isBookmarked ? (
                <BookmarkCheck className="size-3.5" strokeWidth={2} />
              ) : (
                <Bookmark className="size-3.5" strokeWidth={1.9} />
              )}
            </IconButton>
            <IconButton label="Open original story" href={article.url}>
              <ExternalLink className="size-3.5" strokeWidth={1.9} />
            </IconButton>
          </div>
        ) : null}

        {view === "read" && briefing ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.06] hover:text-ink disabled:cursor-progress disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-3", generating && "animate-spin")}
              strokeWidth={2.2}
            />
            {generating ? "Writing…" : "Regenerate"}
          </button>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {generationError && (view === "read" || generating) ? (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-cybersec/20 bg-cybersec/[0.06] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-secondary sm:mx-6">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-cybersec" strokeWidth={2} />
            <div>
              <p className="font-medium text-cybersec">Briefing not generated</p>
              <p className="mt-0.5">{generationError}</p>
            </div>
          </div>
        ) : null}

        {view === "read" ? (
          generating && !briefing ? (
            <BriefingSkeleton />
          ) : briefing ? (
            <article className="mx-auto w-full max-w-[760px] animate-rise px-5 py-7 sm:px-9 sm:py-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8cc4ff]">
                  <Sparkles className="size-3" strokeWidth={2.4} />
                  Daily Read
                </span>
                <span className="rounded-full border border-hairline bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-medium text-ink-secondary">
                  {briefingDesk(briefing.categorySlug)}
                </span>
                {briefing.isDemo ? (
                  <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-1 text-[10.5px] font-medium text-amber-300">
                    Sample
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-balance font-serif text-[30px] font-medium leading-[1.14] tracking-[-0.025em] text-ink sm:text-[38px]">
                {briefing.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-tertiary">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" strokeWidth={2} />
                  {briefing.readTimeMinutes} min read
                </span>
                <span aria-hidden>·</span>
                <span>{briefing.articleCount} sources</span>
                <span aria-hidden>·</span>
                <span>{formatFullDate(briefing.createdAt)}</span>
              </div>

              <div className="mt-7 h-px bg-gradient-to-r from-white/12 via-white/5 to-transparent" />

              <Markdown className="mt-7">{briefing.contentMarkdown}</Markdown>

              <div className="mt-10 rounded-xl border border-hairline bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-ink-tertiary">
                {briefing.isDemo
                  ? "A sample briefing bundled with Digestr."
                  : `Synthesized with ${providerLabel(briefing.provider)} from ${briefing.articleCount} stories.`}{" "}
                Summaries can be wrong — follow the citations to the primary
                reporting.
              </div>
            </article>
          ) : (
            <Placeholder
              icon={Sparkles}
              title="Today's read is waiting"
              body="Generate one calm, cited briefing from the best reporting across your sources."
              action={
                <button
                  type="button"
                  onClick={onGenerate}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[12px] font-semibold text-obsidian transition hover:bg-white"
                >
                  <Sparkles className="size-3.5" strokeWidth={2.4} />
                  Generate your read
                </button>
              }
            />
          )
        ) : article ? (
          <article className="mx-auto w-full max-w-[760px] animate-rise px-5 py-7 sm:px-9 sm:py-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-medium text-ink-secondary">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: article.categoryColor }}
                />
                {article.categoryName}
              </span>
              <span className="text-[10.5px] text-ink-tertiary">
                {sourceTypeLabel(article.sourceType)}
              </span>
              {article.isDemo ? (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  Demo story
                </span>
              ) : null}
            </div>

            <h1 className="mt-4 text-balance font-serif text-[29px] font-medium leading-[1.16] tracking-[-0.02em] text-ink sm:text-[37px]">
              {article.title}
            </h1>

            <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-tertiary">
              <span className="font-medium text-ink-secondary">
                {article.feedName}
              </span>
              <span aria-hidden>·</span>
              <span>{formatFullDate(article.publishedAt)}</span>
              <span aria-hidden>·</span>
              <span>{formatRelativeTime(article.publishedAt)}</span>
            </div>

            {article.snippet ? (
              <p className="mt-7 border-l-2 border-white/10 pl-4 font-serif text-[17px] leading-[1.7] text-ink-secondary sm:text-[18px]">
                {article.snippet}
              </p>
            ) : (
              <p className="mt-7 font-serif text-[16px] leading-[1.7] text-ink-tertiary">
                This source doesn&apos;t include a summary in its feed. Open the
                original story to read it in full.
              </p>
            )}

            <div className="mt-8 rounded-2xl border border-hairline bg-white/[0.025] p-4">
              <p className="text-[11.5px] leading-relaxed text-ink-secondary">
                Digestr stores the headline and summary from the feed.
                Continue to {hostnameFromUrl(article.url)} for the complete
                story.
              </p>
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-obsidian transition hover:bg-white"
              >
                Read on {hostnameFromUrl(article.url)}
                <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
              </a>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-hairline pt-4 text-[11px] text-ink-tertiary">
              <span>Published {formatFullDate(article.publishedAt)}</span>
              <button
                type="button"
                onClick={() => onToggleBookmark(article)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition",
                  article.isBookmarked
                    ? "text-accent hover:bg-accent-soft"
                    : "text-ink-secondary hover:bg-white/[0.05] hover:text-ink",
                )}
              >
                {article.isBookmarked ? (
                  <BookmarkCheck className="size-3.5" strokeWidth={2} />
                ) : (
                  <Bookmark className="size-3.5" strokeWidth={1.9} />
                )}
                {article.isBookmarked ? "Saved for later" : "Save for later"}
              </button>
            </div>
          </article>
        ) : (
          <Placeholder
            icon={Newspaper}
            title="Choose a story to begin"
            body="Select a headline from the feed, or generate a briefing for the day."
            action={
              <button
                type="button"
                onClick={onOpenFeed}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink"
              >
                Open live feed
              </button>
            }
          />
        )}
      </div>
    </section>
  );
}

function Placeholder({
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
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <div className="grid size-12 place-items-center rounded-2xl border border-hairline bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <Icon className="size-[18px] text-ink-tertiary" strokeWidth={1.7} />
      </div>
      <p className="mt-4 text-[13.5px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-[300px] text-[11.5px] leading-relaxed text-ink-tertiary">
        {body}
      </p>
      {action}
    </div>
  );
}

function BriefingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-9 sm:py-10">
      <div className="flex items-center gap-2 text-[11.5px] text-[#8cc4ff]">
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
        Reading today&apos;s reporting and drafting your briefing…
      </div>
      <div className="skeleton mt-6 h-8 w-4/5 rounded-lg" />
      <div className="skeleton mt-2 h-8 w-2/3 rounded-lg" />
      <div className="skeleton mt-5 h-2.5 w-40 rounded-full" />
      <div className="mt-8 space-y-2.5">
        {[100, 96, 99, 78, 0, 98, 94, 86, 0, 99, 92, 97, 72].map(
          (width, index) =>
            width === 0 ? (
              <div key={index} className="h-2" />
            ) : (
              <div
                key={index}
                className="skeleton h-2.5 rounded-full"
                style={{ width: `${width}%` }}
              />
            ),
        )}
      </div>
    </div>
  );
}
