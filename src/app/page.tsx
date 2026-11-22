import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Database,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { articles, briefings, categories, feeds } from "@/db/schema";

export const dynamic = "force-dynamic";

type DbStatus =
  | {
      ready: true;
      categories: number;
      feeds: number;
      articles: number;
      briefings: number;
    }
  | { ready: false; error: string };

async function getDbStatus(): Promise<DbStatus> {
  try {
    const [categoryRows, feedRows, articleRows, briefingRows] =
      await Promise.all([
        db.select({ value: count() }).from(categories),
        db.select({ value: count() }).from(feeds),
        db.select({ value: count() }).from(articles),
        db.select({ value: count() }).from(briefings),
      ]);

    return {
      ready: true,
      categories: Number(categoryRows[0]?.value ?? 0),
      feeds: Number(feedRows[0]?.value ?? 0),
      articles: Number(articleRows[0]?.value ?? 0),
      briefings: Number(briefingRows[0]?.value ?? 0),
    };
  } catch (error) {
    return {
      ready: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

function StatusRow({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3.5">
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
          done
            ? "bg-positive/15 text-positive"
            : "bg-white/5 text-ink-tertiary"
        }`}
      >
        {done ? (
          <Check className="size-3" strokeWidth={3} />
        ) : (
          <AlertCircle className="size-3" strokeWidth={2.5} />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium tracking-[-0.01em] text-ink">
          {label}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-secondary">
          {detail}
        </p>
      </div>
    </div>
  );
}

export default async function Home() {
  const status = await getDbStatus();
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-8 sm:px-10">
      {/* Ambient light, subtle enough to keep the obsidian surfaces clean. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-48 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />
        <div className="absolute -bottom-56 right-[-10%] h-[420px] w-[620px] rounded-full bg-cybersec/[0.045] blur-[150px]" />
      </div>

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-[11px] border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Newspaper className="size-[18px] text-ink" strokeWidth={1.7} />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">
              The Daily Digest
            </p>
            <p className="text-[11.5px] text-ink-tertiary">
              AI &amp; Cybersecurity, edited for you
            </p>
          </div>
        </div>
        <span className="hidden rounded-full border border-hairline bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-wide text-ink-secondary sm:inline-flex">
          Engine · Step 2
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-[560px]">
          <div className="mb-8 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-3.5 py-1.5 text-[11.5px] font-medium text-[#6db6ff]">
              <Sparkles className="size-3.5" strokeWidth={2} />
              Two ways to read the day
            </div>
            <h1 className="text-balance text-[38px] font-semibold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[44px]">
              The news, without
              <br />
              the noise.
            </h1>
            <p className="mx-auto mt-4 max-w-[430px] text-balance text-[14.5px] leading-relaxed text-ink-secondary">
              Browse live headlines from the best AI and security sources — or
              generate one calm, cited briefing, written like a senior tech
              editor.
            </p>
          </div>

          <section className="glass overflow-hidden rounded-panel shadow-panel">
            <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
              <Database className="size-3.5 text-ink-tertiary" strokeWidth={2} />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
                Local setup
              </h2>
              <span className="ml-auto text-[11px] text-ink-tertiary">
                {status.ready ? "SQLite connected" : "Waiting for database"}
              </span>
            </div>

            <div className="divide-y divide-hairline px-5 py-1">
              <StatusRow
                done
                label="Project scaffolded"
                detail="Next.js 16 · TypeScript · Tailwind CSS 4 · Drizzle ORM"
              />
              <StatusRow
                done={status.ready}
                label="SQLite database"
                detail={
                  status.ready
                    ? `${status.categories} categories · ${status.feeds} sources · ${status.articles} articles`
                    : "Run `npm run db:setup` to migrate and seed the database."
                }
              />
              <StatusRow
                done={status.ready && status.articles > 0}
                label="RSS ingestion"
                detail={
                  status.ready && status.articles > 0
                    ? `${status.articles} article${status.articles === 1 ? "" : "s"} ingested with cross-feed deduplication.`
                    : "Run POST /api/feeds/sync to fetch the live headlines."
                }
              />
              <StatusRow
                done={status.ready && status.briefings > 0}
                label="Daily briefing"
                detail={
                  status.ready && status.briefings > 0
                    ? `${status.briefings} briefing${status.briefings === 1 ? "" : "s"} ready to read.`
                    : "Sync stories, then POST /api/briefings/generate for a cited briefing."
                }
              />
              <StatusRow
                done={geminiConfigured}
                label="Gemini API key"
                detail={
                  geminiConfigured
                    ? "GEMINI_API_KEY detected. Editorial synthesis is wired up."
                    : "Add GEMINI_API_KEY to .env (only needed for synthesis)."
                }
              />
            </div>
          </section>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-ink-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <code className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary">
                npm run db:setup
              </code>
              migrate &amp; seed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <code className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary">
                npm run dev
              </code>
              start reading
            </span>
            <a
              href="https://ai.google.dev/gemini-api/docs/api-key"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ink-secondary transition-colors hover:text-ink"
            >
              Get a Gemini key
              <ArrowUpRight className="size-3" strokeWidth={2} />
            </a>
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-hairline pt-4 text-[11px] text-ink-tertiary">
        <span>Built for a slower, more deliberate read.</span>
        <span className="hidden sm:inline">Obsidian · Frosted · Yours</span>
      </footer>
    </main>
  );
}
