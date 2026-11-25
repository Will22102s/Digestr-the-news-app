"use client";

import {
  Bookmark,
  Layers,
  Newspaper,
  RefreshCw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CategoryFilter } from "@/lib/categories";
import { formatRelativeTime } from "@/lib/format";
import type { ViewMode } from "@/lib/types";

type SidebarCounts = {
  all: number;
  ai: number;
  cybersec: number;
  bookmarks: number;
  briefings: number;
  sources: number;
};

type SidebarProps = {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  counts: SidebarCounts;
  lastSyncedAt: string | null;
  syncing: boolean;
  onSync: () => void;
  onOpenSources: () => void;
  onClose?: () => void;
  className?: string;
};

const NAV_ITEMS: Array<{
  view: ViewMode;
  label: string;
  icon: typeof Sparkles;
}> = [
  { view: "read", label: "Today's Read", icon: Sparkles },
  { view: "feed", label: "Live Feed", icon: Newspaper },
  { view: "bookmarks", label: "Bookmarks", icon: Bookmark },
];

const DESKS: Array<{
  category: CategoryFilter;
  label: string;
  color: string | null;
}> = [
  { category: "ALL", label: "All stories", color: null },
  { category: "AI", label: "Artificial Intelligence", color: "#0A84FF" },
  { category: "CYBERSEC", label: "Cybersecurity", color: "#FF453A" },
];

export function Sidebar({
  view,
  onViewChange,
  category,
  onCategoryChange,
  counts,
  lastSyncedAt,
  syncing,
  onSync,
  onOpenSources,
  onClose,
  className,
}: SidebarProps) {
  const countFor = (item: ViewMode) => {
    if (item === "read") return counts.briefings;
    if (item === "bookmarks") return counts.bookmarks;
    return counts.all;
  };

  const countForCategory = (value: CategoryFilter) => {
    if (value === "AI") return counts.ai;
    if (value === "CYBERSEC") return counts.cybersec;
    return counts.all;
  };

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-hairline bg-panel/55 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Newspaper className="size-4 text-ink" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold tracking-[-0.02em] text-ink">
            The Daily Digest
          </p>
          <p className="truncate text-[10.5px] text-ink-tertiary">
            AI &amp; Cybersecurity
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-7 place-items-center rounded-lg text-ink-tertiary transition hover:bg-white/[0.05] hover:text-ink lg:hidden"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <nav className="space-y-0.5 px-2" aria-label="Views">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.view;

          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onViewChange(item.view)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-white/[0.07] text-ink"
                  : "text-ink-secondary hover:bg-white/[0.04] hover:text-ink",
              )}
            >
              <Icon
                className={cn(
                  "size-[15px] shrink-0",
                  active
                    ? "text-ink"
                    : "text-ink-tertiary group-hover:text-ink-secondary",
                )}
                strokeWidth={1.9}
              />
              <span className="truncate">{item.label}</span>
              <span className="ml-auto rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] tabular-nums text-ink-tertiary">
                {countFor(item.view)}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mx-4 my-3 border-t border-hairline" />

      <div className="px-4">
        <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
          Desks
        </p>
        <div className="space-y-0.5">
          {DESKS.map((desk) => {
            const active = category === desk.category;

            return (
              <button
                key={desk.category}
                type="button"
                onClick={() => onCategoryChange(desk.category)}
                aria-pressed={active}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-[7px] text-[12px] transition-colors",
                  active
                    ? "bg-white/[0.07] font-medium text-ink"
                    : "text-ink-secondary hover:bg-white/[0.04] hover:text-ink",
                )}
              >
                {desk.color ? (
                  <span
                    aria-hidden
                    className="size-[7px] shrink-0 rounded-full"
                    style={{
                      backgroundColor: desk.color,
                      boxShadow: active ? `0 0 0 3px ${desk.color}22` : "none",
                    }}
                  />
                ) : (
                  <Layers
                    className="size-[13px] shrink-0 text-ink-tertiary"
                    strokeWidth={2}
                  />
                )}
                <span className="truncate">{desk.label}</span>
                <span className="ml-auto text-[10px] tabular-nums text-ink-tertiary">
                  {countForCategory(desk.category)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto px-3 pb-3 pt-5">
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-hairline bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-ink-secondary transition hover:bg-white/[0.07] hover:text-ink disabled:cursor-progress disabled:opacity-60"
        >
          <RefreshCw
            className={cn("size-3.5", syncing && "animate-spin")}
            strokeWidth={2}
          />
          {syncing ? "Syncing feeds…" : "Sync now"}
        </button>

        <button
          type="button"
          onClick={onOpenSources}
          className="mt-1 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-[12px] font-medium text-ink-secondary transition hover:bg-white/[0.04] hover:text-ink"
        >
          <Settings2 className="size-3.5 text-ink-tertiary" strokeWidth={1.9} />
          Manage sources
          <span className="ml-auto text-[10.5px] tabular-nums text-ink-tertiary">
            {counts.sources}
          </span>
        </button>

        <p className="mt-2.5 px-1 text-[10.5px] leading-relaxed text-ink-tertiary">
          {counts.sources} source{counts.sources === 1 ? "" : "s"}
          {lastSyncedAt
            ? ` · synced ${formatRelativeTime(lastSyncedAt).toLowerCase()}`
            : " · not synced yet"}
        </p>
      </div>
    </aside>
  );
}
