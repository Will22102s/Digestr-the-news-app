import { Database, Newspaper } from "lucide-react";
import { DigestApp, type InitialDigestData } from "@/components/DigestApp";
import {
  getDigestStats,
  listArticles,
  listBriefings,
} from "@/lib/server-queries";

export const dynamic = "force-dynamic";

async function loadInitialData(): Promise<InitialDigestData> {
  const [articleResult, briefingResult, stats] = await Promise.all([
    listArticles({ category: "ALL", limit: 60 }),
    listBriefings({ limit: 20 }),
    getDigestStats(),
  ]);

  return {
    view: briefingResult.briefings.length > 0 ? "read" : "feed",
    articles: articleResult.articles,
    articleTotal: articleResult.total,
    briefings: briefingResult.briefings,
    stats,
  };
}

function SetupScreen({ message }: { message: string | null }) {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-10">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-[11px] border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Newspaper className="size-[18px] text-ink" strokeWidth={1.7} />
        </div>
        <div>
          <p className="text-[15px] font-semibold tracking-[-0.02em]">
            Digestr
          </p>
          <p className="text-[11.5px] text-ink-tertiary">
            AI &amp; Cybersecurity, edited for you
          </p>
        </div>
      </div>

      <section className="glass mt-8 rounded-panel p-6">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-ink-tertiary" strokeWidth={2} />
          <h1 className="text-[15px] font-semibold tracking-[-0.02em]">
            Finish setting up the library
          </h1>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-secondary">
          The reader could not read the SQLite database. Run the setup script to
          apply migrations and seed the curated sources, then reload this page.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-hairline bg-black/30 px-4 py-3 font-mono text-[11.5px] text-ink-secondary">
          <code>npm run db:setup{"\n"}npm run dev</code>
        </pre>
        {message ? (
          <p className="mt-3 rounded-lg border border-cybersec/20 bg-cybersec/[0.06] px-3 py-2 font-mono text-[10.5px] leading-relaxed text-ink-tertiary">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default async function Home() {
  let initial: InitialDigestData | null = null;
  let setupError: string | null = null;

  try {
    initial = await loadInitialData();
  } catch (error) {
    setupError =
      error instanceof Error ? error.message : "Unknown database error.";
  }

  if (!initial) return <SetupScreen message={setupError} />;

  return <DigestApp initial={initial} />;
}
