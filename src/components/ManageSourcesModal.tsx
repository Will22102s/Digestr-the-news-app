"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Cpu,
  Download,
  Loader2,
  Plus,
  Rss,
  Search,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  addSource,
  deleteSource,
  getSources,
  importOpml,
  updateSource,
} from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { formatRelativeTime, hostnameFromUrl } from "@/lib/format";
import type { SourceDTO } from "@/lib/types";

type ManageSourcesModalProps = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onToast: (message: string, tone?: "success" | "error") => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function SourceIcon({ type }: { type: SourceDTO["sourceType"] }) {
  if (type === "community") {
    return <Cpu className="size-3.5 text-ink-secondary" strokeWidth={1.9} />;
  }
  if (type === "advisory") {
    return <Shield className="size-3.5 text-ink-secondary" strokeWidth={1.9} />;
  }
  return <Rss className="size-3.5 text-ink-secondary" strokeWidth={1.9} />;
}

function SourceRow({
  source,
  busy,
  confirming,
  onToggle,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  source: SourceDTO;
  busy: boolean;
  confirming: boolean;
  onToggle: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.03]",
        !source.isActive && "opacity-55",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-hairline bg-white/[0.03]">
        {busy ? (
          <Loader2 className="size-3.5 animate-spin text-ink-tertiary" strokeWidth={2} />
        ) : (
          <SourceIcon type={source.sourceType} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-ink">{source.name}</p>
        <p className="truncate text-[10px] text-ink-tertiary">
          {hostnameFromUrl(source.url)} · {source.articleCount} stor
          {source.articleCount === 1 ? "y" : "ies"} ·{" "}
          {source.lastFetchedAt
            ? formatRelativeTime(source.lastFetchedAt).toLowerCase()
            : "never synced"}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={source.isActive}
        aria-label={`${source.isActive ? "Disable" : "Enable"} ${source.name}`}
        onClick={onToggle}
        disabled={busy}
        className={cn(
          "relative h-[20px] w-[34px] shrink-0 rounded-full border transition-colors disabled:cursor-progress",
          source.isActive
            ? "border-accent/40 bg-accent/80"
            : "border-hairline bg-white/[0.06]",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-[14px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-all",
            source.isActive ? "left-[17px]" : "left-[3px]",
          )}
        />
      </button>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-md bg-cybersec/15 px-2 py-1 text-[10.5px] font-semibold text-cybersec transition hover:bg-cybersec/25 disabled:opacity-60"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="rounded-md px-1.5 py-1 text-[10.5px] text-ink-tertiary transition hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Remove ${source.name}`}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-tertiary transition hover:bg-white/[0.05] hover:text-cybersec sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" strokeWidth={1.9} />
        </button>
      )}
    </div>
  );
}

export function ManageSourcesModal({
  open,
  onClose,
  onChanged,
  onToast,
}: ManageSourcesModalProps) {
  const [sources, setSources] = useState<SourceDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState<"AI" | "CYBERSEC">("AI");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSources = useCallback(async () => {
    try {
      const response = await getSources();
      setSources(response.sources);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
      setSources((previous) => previous ?? []);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let active = true;

    getSources()
      .then((response) => {
        if (!active) return;
        setSources(response.sources);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(errorMessage(error));
        setSources((previous) => previous ?? []);
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (pendingDelete === null) return;
    const timer = window.setTimeout(() => setPendingDelete(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingDelete]);

  if (!open) return null;

  const sourceList = sources ?? [];
  const loading = sources === null;
  const activeCount = sourceList.filter((source) => source.isActive).length;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? sourceList.filter(
        (source) =>
          source.name.toLowerCase().includes(normalizedQuery) ||
          source.url.toLowerCase().includes(normalizedQuery),
      )
    : sourceList;

  const groups = (
    [
      {
        slug: "AI" as const,
        name: "Artificial Intelligence",
        color: "#0A84FF",
      },
      { slug: "CYBERSEC" as const, name: "Cybersecurity", color: "#FF453A" },
    ]
  )
    .map((group) => ({
      ...group,
      items: filtered.filter((source) => source.categorySlug === group.slug),
    }))
    .filter((group) => group.items.length > 0);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addUrl.trim() || adding) return;

    setAdding(true);
    setFormError(null);

    try {
      const response = await addSource({
        url: addUrl.trim(),
        name: addName.trim() || undefined,
        categorySlug: addCategory,
      });

      setAddUrl("");
      setAddName("");
      await loadSources();
      await onChanged();
      onToast(
        `Added ${response.source.name} — ${response.previewItems} item${
          response.previewItems === 1 ? "" : "s"
        } found.`,
      );
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (source: SourceDTO) => {
    if (busyId !== null) return;
    setBusyId(source.id);

    try {
      await updateSource({ id: source.id, isActive: !source.isActive });
      setSources((previous) =>
        (previous ?? []).map((item) =>
          item.id === source.id ? { ...item, isActive: !item.isActive } : item,
        ),
      );
      await onChanged();
      onToast(
        `${source.name} ${source.isActive ? "paused" : "enabled"}.`,
      );
    } catch (error) {
      onToast(errorMessage(error), "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (source: SourceDTO) => {
    if (pendingDelete !== source.id) {
      setPendingDelete(source.id);
      return;
    }

    setBusyId(source.id);
    try {
      await deleteSource(source.id);
      setSources((previous) =>
        (previous ?? []).filter((item) => item.id !== source.id),
      );
      setPendingDelete(null);
      await onChanged();
      onToast(`Removed ${source.name}.`);
    } catch (error) {
      onToast(errorMessage(error), "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importing) return;

    setImporting(true);
    try {
      const result = await importOpml(file);
      await loadSources();
      await onChanged();
      onToast(
        `Imported ${result.imported} source${
          result.imported === 1 ? "" : "s"
        } · ${result.skipped} already present.`,
      );
    } catch (error) {
      onToast(errorMessage(error), "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sources-title"
    >
      <button
        type="button"
        aria-label="Close sources"
        onClick={onClose}
        className="absolute inset-0 animate-fade cursor-default bg-black/65 backdrop-blur-md"
      />

      <div className="relative flex max-h-[92dvh] w-full max-w-[720px] animate-rise flex-col overflow-hidden rounded-t-[24px] border border-hairline bg-panel shadow-popover sm:max-h-[85dvh] sm:rounded-[24px]">
        <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-5 py-4">
          <div className="grid size-8 place-items-center rounded-[10px] border border-hairline bg-white/[0.04]">
            <Rss className="size-4 text-ink" strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="sources-title"
              className="text-[14.5px] font-semibold tracking-[-0.02em] text-ink"
            >
              Manage sources
            </h2>
            <p className="text-[10.5px] text-ink-tertiary">
              {sourceList.length} feeds · {activeCount} active
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-ink-tertiary transition hover:bg-white/[0.05] hover:text-ink"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <form onSubmit={handleAdd} className="border-b border-hairline px-5 py-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  value={addUrl}
                  onChange={(event) => setAddUrl(event.target.value)}
                  placeholder="https://example.com/feed.xml"
                  aria-label="Feed URL"
                  className="h-9 min-w-0 flex-1 rounded-[9px] border border-hairline bg-white/[0.03] px-3 text-[12px] text-ink outline-none transition placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
                />
                <select
                  value={addCategory}
                  onChange={(event) =>
                    setAddCategory(event.target.value as "AI" | "CYBERSEC")
                  }
                  aria-label="Category"
                  className="h-9 rounded-[9px] border border-hairline bg-white/[0.03] px-2.5 text-[12px] text-ink outline-none transition focus:border-white/20 sm:w-[150px]"
                >
                  <option value="AI">AI</option>
                  <option value="CYBERSEC">Cybersecurity</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                  placeholder="Display name (optional — detected automatically)"
                  aria-label="Display name"
                  className="h-9 min-w-0 flex-1 rounded-[9px] border border-hairline bg-white/[0.03] px-3 text-[12px] text-ink outline-none transition placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
                />
                <button
                  type="submit"
                  disabled={adding || !addUrl.trim()}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-ink px-3 text-[12px] font-semibold text-obsidian transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-[104px]"
                >
                  {adding ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2.4} />
                  ) : (
                    <Plus className="size-3.5" strokeWidth={2.6} />
                  )}
                  {adding ? "Adding" : "Add feed"}
                </button>
              </div>

              {formError ? (
                <p className="flex items-start gap-1.5 rounded-lg border border-cybersec/20 bg-cybersec/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-ink-secondary">
                  <AlertCircle className="mt-0.5 size-3 shrink-0 text-cybersec" strokeWidth={2} />
                  {formError}
                </p>
              ) : null}
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3">
            <p className="mr-auto text-[11px] text-ink-tertiary">
              Bring your own feeds or take this list with you.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".opml,.xml,application/xml,text/xml"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.06] hover:text-ink disabled:opacity-60"
            >
              {importing ? (
                <Loader2 className="size-3 animate-spin" strokeWidth={2.4} />
              ) : (
                <Upload className="size-3" strokeWidth={2.2} />
              )}
              Import OPML
            </button>
            <a
              href="/api/sources/opml"
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition hover:bg-white/[0.06] hover:text-ink"
            >
              <Download className="size-3" strokeWidth={2.2} />
              Export
              <ArrowUpRight className="size-2.5 text-ink-tertiary" strokeWidth={2.4} />
            </a>
          </div>

          <div className="px-5 pt-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-tertiary"
                strokeWidth={2}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter sources…"
                aria-label="Filter sources"
                className="h-8 w-full rounded-[9px] border border-hairline bg-white/[0.03] pl-8 pr-3 text-[12px] text-ink outline-none transition placeholder:text-ink-tertiary focus:border-white/20 focus:bg-white/[0.05]"
              />
            </div>
          </div>

          <div className="px-3 pb-5 pt-1">
            {loading ? (
              <div className="space-y-1 px-1 pt-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-2.5 px-1.5 py-2">
                    <div className="skeleton size-7 rounded-lg" />
                    <div className="flex-1">
                      <div className="skeleton h-2.5 w-40 rounded-full" />
                      <div className="skeleton mt-1.5 h-2 w-56 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="mx-1 mt-3 rounded-xl border border-cybersec/20 bg-cybersec/[0.06] p-3 text-[11.5px] text-ink-secondary">
                <p className="font-medium text-cybersec">Could not load sources</p>
                <p className="mt-1">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void loadSources()}
                  className="mt-2 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-ink transition hover:bg-white/[0.1]"
                >
                  Try again
                </button>
              </div>
            ) : groups.length === 0 ? (
              <p className="px-2 py-8 text-center text-[11.5px] text-ink-tertiary">
                {normalizedQuery
                  ? `No sources match “${query}”.`
                  : "No sources yet. Add a feed above."}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.slug} className="mt-3">
                  <div className="flex items-center gap-2 px-2 pb-1">
                    <span
                      aria-hidden
                      className="size-[6px] rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
                      {group.name}
                    </p>
                    <span className="text-[9.5px] tabular-nums text-ink-tertiary">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {group.items.map((source) => (
                      <SourceRow
                        key={source.id}
                        source={source}
                        busy={busyId === source.id}
                        confirming={pendingDelete === source.id}
                        onToggle={() => void handleToggle(source)}
                        onRequestDelete={() => setPendingDelete(source.id)}
                        onCancelDelete={() => setPendingDelete(null)}
                        onDelete={() => void handleDelete(source)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
